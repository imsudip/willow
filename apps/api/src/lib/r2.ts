import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { audioUploads } from "../db/schema.js";
import { env } from "../env.js";

// S3-compatible client pointed at Cloudflare R2. Credentials live only
// server-side; the browser talks to R2 via short-lived presigned URLs.
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export function audioKey(userId: string, entryId: string) {
  return `audio/${userId}/${entryId}.webm`;
}

/**
 * 1-hour presigned URL for the browser to PUT the audio blob straight to R2.
 * The signed ContentLength pins the maximum upload size server-side, so a
 * client can't exceed the configured cap even with a valid URL.
 */
export async function createUploadUrl(userId: string, entryId: string) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: audioKey(userId, entryId),
      ContentType: "audio/webm",
      ContentLength: env.MAX_AUDIO_UPLOAD_BYTES,
    }),
    { expiresIn: 3600 },
  );
}

/** 1-hour presigned GET for playback (short expiry limits Class B abuse). */
export async function createDownloadUrl(userId: string, entryId: string) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: audioKey(userId, entryId) }),
    { expiresIn: 3600 },
  );
}

/** True if the object exists in R2 (used to confirm a completed upload). */
export async function audioObjectExists(userId: string, entryId: string): Promise<boolean> {
  try {
    await r2.send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: audioKey(userId, entryId) }),
    );
    return true;
  } catch (err) {
    // 404/403 from R2 both mean "no object we can read" — treat as absent.
    return false;
  }
}

export async function deleteAudio(userId: string, entryId: string) {
  await r2.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: audioKey(userId, entryId) }),
  );
}

/**
 * Current bucket storage in bytes (free-tier gate).
 *
 * Uses the documented account-level metrics endpoint
 * (GET /accounts/{account_id}/r2/metrics). The response nests
 * payloadSize/metadataSize by storage class and state; parse defensively and
 * fall back to a flat shape, summing all payload + metadata bytes.
 * Note: account-level metrics can lag slightly behind live writes.
 */
export async function getBucketUsageBytes(): Promise<number> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/metrics`,
    { headers: { Authorization: `Bearer ${env.R2_API_TOKEN}` } },
  );
  if (!res.ok) throw new Error(`R2 usage check failed (${res.status})`);
  const data = (await res.json()) as unknown;

  let payloadSize = 0;
  let metadataSize = 0;
  // Prefer the documented nested shape, then fall back to a flat result.
  const result = (data as { result?: unknown }).result ?? {};
  const groups = (result as { storageAdaptiveGroups?: unknown }).storageAdaptiveGroups
    ?? (result as { storage?: unknown }).storage
    ?? result;
  const entriesArr = Array.isArray(groups)
    ? groups
    : [groups];

  for (const entry of entriesArr as Record<string, unknown>[]) {
    const p = entry.payloadSize ?? entry.payloadBytes;
    const m = entry.metadataSize ?? entry.metadataBytes;
    if (typeof p === "string" || typeof p === "number") payloadSize += Number(p);
    if (typeof m === "string" || typeof m === "number") metadataSize += Number(m);
  }
  return payloadSize + metadataSize;
}

/**
 * Per-user daily upload quota. Atomically counts today's reservations and
 * inserts a new one in a single transaction so concurrent requests can't
 * bypass MAX_UPLOADS_PER_USER_PER_DAY. The count query locks the user's rows
 * (FOR UPDATE) to serialize concurrent mints for the same user.
 */
export async function assertUploadQuota(userId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return db.transaction(async (tx) => {
    const today = await tx
      .select({ id: audioUploads.id })
      .from(audioUploads)
      .where(and(eq(audioUploads.userId, userId), gte(audioUploads.createdAt, startOfDay)))
      .for("update");
    if (today.length >= env.MAX_UPLOADS_PER_USER_PER_DAY) return false;

    await tx.insert(audioUploads).values({ id: crypto.randomUUID(), userId });
    return true;
  });
}

/** Releases a reserved quota slot (called when minting/upload fails). */
export async function releaseUploadQuota(userId: string, since: Date) {
  await db.delete(audioUploads).where(and(eq(audioUploads.userId, userId), lt(audioUploads.createdAt, since)));
}

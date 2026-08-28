import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, gte } from "drizzle-orm";
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

/** 1-hour presigned URL for the browser to PUT the audio blob straight to R2. */
export async function createUploadUrl(userId: string, entryId: string) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: audioKey(userId, entryId),
      ContentType: "audio/webm",
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

export async function deleteAudio(userId: string, entryId: string) {
  await r2.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: audioKey(userId, entryId) }),
  );
}

/** Current bucket storage in bytes (free-tier gate). Uses the R2 REST usage endpoint. */
export async function getBucketUsageBytes(): Promise<number> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET}/usage`,
    { headers: { Authorization: `Bearer ${env.R2_API_TOKEN}` } },
  );
  if (!res.ok) throw new Error(`R2 usage check failed (${res.status})`);
  const data = (await res.json()) as {
    result: { payloadSize?: string; metadataSize?: string };
  };
  return Number(data.result.payloadSize ?? 0) + Number(data.result.metadataSize ?? 0);
}

/**
 * Per-user daily upload quota. Records each minted upload URL in Postgres
 * (audit + rate gate); rejects once the user exceeds the daily cap.
 */
export async function assertUploadQuota(userId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = await db
    .select({ id: audioUploads.id })
    .from(audioUploads)
    .where(and(eq(audioUploads.userId, userId), gte(audioUploads.createdAt, startOfDay)));
  if (today.length >= env.MAX_UPLOADS_PER_USER_PER_DAY) return false;

  await db.insert(audioUploads).values({ id: crypto.randomUUID(), userId });
  return true;
}

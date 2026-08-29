import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, neonSql } from "./db/index";
import { audioUploads } from "./db/schema";
import { env } from "./env";

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
 * ContentLength is signed with the exact byte size the client declared and
 * the server validated, so a mismatched-size upload is rejected by R2.
 */
export async function createUploadUrl(userId: string, entryId: string, byteLength: number) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: audioKey(userId, entryId),
      ContentType: "audio/webm",
      ContentLength: byteLength,
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

/**
 * The stored object's ContentLength in bytes, or null when the object
 * doesn't exist. Used by audio-complete to confirm the upload matches the
 * size that was authorized.
 */
export async function audioObjectSize(userId: string, entryId: string): Promise<number | null> {
  try {
    const head = await r2.send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: audioKey(userId, entryId) }),
    );
    return head.ContentLength ?? null;
  } catch (err) {
    // 404/403 from R2 both mean "no object we can read" — treat as absent.
    return null;
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
 * (GET /accounts/{account_id}/r2/metrics). The documented response nests
 * payloadSize/metadataSize under storage class (standard / infrequentAccess)
 * and state (published / uploaded); traverse that hierarchy and fall back to
 * any flat storage groups if present. Account-level metrics can lag slightly
 * behind live writes.
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

  const result = (data as { result?: unknown }).result ?? {};
  const classes: unknown[] = [];
  // Documented shape: { standard?: {...}, infrequentAccess?: {...} }
  for (const key of ["standard", "infrequentAccess"]) {
    const cls = (result as Record<string, unknown>)[key];
    if (cls && typeof cls === "object") {
      // Each class nests { published?: {...}, uploaded?: {...} }.
      const states = (cls as Record<string, unknown>).published
        ? [cls]
        : Object.values(cls as Record<string, unknown>);
      classes.push(...states);
    }
  }
  // Fallback shapes: storageAdaptiveGroups / storage arrays or a flat result.
  const groups = (result as { storageAdaptiveGroups?: unknown }).storageAdaptiveGroups
    ?? (result as { storage?: unknown }).storage;
  if (groups !== undefined) classes.push(...(Array.isArray(groups) ? groups : [groups]));
  if (classes.length === 0 && Object.keys(result as Record<string, unknown>).length > 0) {
    classes.push(result);
  }

  for (const entry of classes as Record<string, unknown>[]) {
    const p = entry.payloadSize ?? entry.payloadBytes;
    const m = entry.metadataSize ?? entry.metadataBytes;
    if (typeof p === "string" || typeof p === "number") payloadSize += Number(p);
    if (typeof m === "string" || typeof m === "number") metadataSize += Number(m);
  }
  return payloadSize + metadataSize;
}

/**
 * Per-user daily upload quota. Atomically reserves a slot only when the user
 * is under MAX_UPLOADS_PER_USER_PER_DAY for today.
 *
 * Uses a single conditional INSERT (CTE) so the count+insert is atomic over
 * HTTP — drizzle-orm/neon-http doesn't support interactive transactions, and
 * the old `db.transaction` + advisory-lock pattern threw at runtime. The
 * statement inserts a row only if today's count is below the cap, and returns
 * it; if nothing was inserted, the quota is exhausted.
 */
export async function assertUploadQuota(userId: string): Promise<boolean> {
  const rows = (await neonSql`
    WITH inserted AS (
      INSERT INTO audio_uploads (id, user_id, created_at)
      SELECT ${crypto.randomUUID()}, ${userId}, now()
      WHERE (
        SELECT count(*) FROM audio_uploads
        WHERE user_id = ${userId} AND created_at >= (now() - interval '1 day')
      ) < ${env.MAX_UPLOADS_PER_USER_PER_DAY}
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM inserted
  `) as unknown as { inserted: number }[];
  const n = Number(rows[0]?.inserted ?? 0);
  return n > 0;
}

/**
 * Releases the user's most recent quota reservation (called when minting
 * fails or the client reports a failed upload). Only the newest slot is
 * removed so successful uploads' reservations stay counted.
 */
export async function releaseUploadQuota(userId: string) {
  const latest = await db
    .select({ id: audioUploads.id })
    .from(audioUploads)
    .where(eq(audioUploads.userId, userId))
    .orderBy(audioUploads.createdAt)
    .limit(1);
  if (latest.length === 0) return;
  await db.delete(audioUploads).where(eq(audioUploads.id, latest[0].id));
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { UserConfig, UserConfigUpdate } from "@willow/shared";
import { db } from "./db/index";
import { userConfig } from "./db/schema";
import { env } from "./env";

/**
 * Per-user configuration + bring-your-own OpenAI key.
 *
 * One `user_config` row per user (a JSON `config` document). The BYO OpenAI
 * key is stored AES-256-GCM encrypted with a key derived from the app secret
 * (USER_CONFIG_SECRET, falling back to AUTH_SECRET) — never plaintext, and
 * never returned to the client (the client only sees `openaiKeyConfigured`).
 *
 * "Hashed" is the wrong primitive for a key you must USE (you can't call
 * OpenAI with a one-way hash), so this is symmetric encryption: only Willow
 * can decrypt it, an R2/DB leak doesn't expose keys, and the plaintext never
 * touches the client or logs.
 */

export const DEFAULT_CONFIG: UserConfig = {
  reminderTime: "18:30",
  chimesEnabled: true,
  appearance: "system",
  openaiKeyConfigured: false,
};

/** Base64-encoded AES-256-GCM payload: <iv(12)>:<tag(16)>:<ciphertext> */
const PAYLOAD_SEP = ":";
const IV_LEN = 12;
const TAG_LEN = 16;

function appSecret(): string {
  return env.USER_CONFIG_SECRET ?? env.AUTH_SECRET;
}

/** 32-byte key from the app secret (SHA-256, so any length is fine). */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(plaintext: string): string {
  const key = deriveKey(appSecret());
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(PAYLOAD_SEP);
}

function decryptSecret(payload: string): string {
  const key = deriveKey(appSecret());
  const [ivB64, tagB64, dataB64] = payload.split(PAYLOAD_SEP);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export { encryptSecret, decryptSecret };

/** Returns the user's stored config, creating a default row on first read. */
export async function getConfig(userId: string): Promise<UserConfig> {
  const row = await db
    .select()
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);

  if (row.length === 0) {
    const created = await db
      .insert(userConfig)
      .values({ userId, config: { ...DEFAULT_CONFIG } })
      .onConflictDoNothing({ target: [userConfig.userId] })
      .returning();
    if (created.length > 0) return { ...DEFAULT_CONFIG };
    // Concurrent first-read: someone else just created the row.
    const again = await db
      .select()
      .from(userConfig)
      .where(eq(userConfig.userId, userId))
      .limit(1);
    return normalize(again[0]);
  }
  return normalize(row[0]);
}

/** Applies a partial update to the user's config JSON (server-side). */
export async function updateConfig(
  userId: string,
  patch: UserConfigUpdate,
): Promise<UserConfig> {
  const current = await getConfig(userId);
  const next = { ...current, ...patch, openaiKeyConfigured: current.openaiKeyConfigured };
  await db
    .insert(userConfig)
    .values({ userId, config: next })
    .onConflictDoUpdate({
      target: [userConfig.userId],
      set: { config: next, updatedAt: new Date() },
    });
  return next;
}

/**
 * Stores (or clears) the user's BYO OpenAI key. Encrypted with the app secret;
 * also bumps `keyUpdatedAt` so cached per-user OpenAI clients are invalidated.
 * Returns nothing about the key itself.
 */
export async function setOpenaiKey(
  userId: string,
  apiKey: string | null,
): Promise<{ openaiKeyConfigured: boolean }> {
  const now = new Date();
  const enc = apiKey === null ? null : encryptSecret(apiKey);
  const row = await db
    .insert(userConfig)
    .values({
      userId,
      config: { ...DEFAULT_CONFIG },
      openaiApiKeyEnc: enc,
      keyUpdatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userConfig.userId],
      set: { openaiApiKeyEnc: enc, keyUpdatedAt: now, updatedAt: now },
    })
    .returning();
  return { openaiKeyConfigured: Boolean(row[0].openaiApiKeyEnc) };
}

/**
 * Resolves the OpenAI key to use for a user: their BYO key if set, else the
 * app-level OPENAI_API_KEY. Returns null if neither is configured.
 */
export async function resolveOpenaiKey(userId: string): Promise<string | null> {
  const row = await db
    .select({ openaiApiKeyEnc: userConfig.openaiApiKeyEnc })
    .from(userConfig)
    .where(eq(userConfig.userId, userId))
    .limit(1);
  if (row.length === 0 || !row[0].openaiApiKeyEnc) return null;
  try {
    return decryptSecret(row[0].openaiApiKeyEnc);
  } catch {
    // Corrupt/undecryptable (e.g. secret changed) — treat as unset.
    return null;
  }
}

function normalize(row: {
  config: {
    reminderTime: string;
    chimesEnabled: boolean;
    appearance: "light" | "dark" | "system";
  };
  openaiApiKeyEnc: string | null;
}): UserConfig {
  return {
    reminderTime: row.config?.reminderTime ?? DEFAULT_CONFIG.reminderTime,
    chimesEnabled: row.config?.chimesEnabled ?? DEFAULT_CONFIG.chimesEnabled,
    appearance: row.config?.appearance ?? DEFAULT_CONFIG.appearance,
    openaiKeyConfigured: Boolean(row.openaiApiKeyEnc),
  };
}

/** Convenience guard used by routes that need an AI key for a user. */
export async function openaiAvailableFor(userId: string): Promise<boolean> {
  return (await resolveOpenaiKey(userId)) !== null;
}

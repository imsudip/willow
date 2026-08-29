import { z } from "zod";
import { DEFAULT_CLEANUP_MODEL, FALLBACK_TRANSCRIPTION_MODEL } from "@willow/shared";

/**
 * Server-side environment schema (Next.js). All values come from Vercel
 * project env in prod, or the repo-root .env.local in dev (loaded by
 * instrumentation/next-config; see README). Server-only — never expose to the
 * client.
 */
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  // Must be a valid batch transcription model (e.g. gpt-4o-mini-transcribe).
  TRANSCRIPTION_MODEL: z.string().default(FALLBACK_TRANSCRIPTION_MODEL),
  CLEANUP_MODEL: z.string().default(DEFAULT_CLEANUP_MODEL),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // Client-visible VAPID public key (push). Bundled to the browser, so it
  // must be safe to expose; kept separate from the server-side key pair.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  REMINDER_CRON: z.string().default("30 18 * * *"),
  CRON_TIMEZONE: z.string().default("Asia/Kolkata"),
  CRON_SECRET: z.string().min(16),
  AUTH_SECRET: z.string().min(8),
  PUBLIC_ORIGIN: z.string().url().optional(),

  // Postgres (Neon). Injected as DATABASE_URL on Vercel; from .env.local locally.
  DATABASE_URL: z.string().min(1),

  // Cloudflare R2 (audio storage + presigned URLs).
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_API_TOKEN: z.string().min(1), // Cloudflare API token with R2 read (usage checks)
  R2_BUCKET: z.string().default("willow-audio"),

  // Free-tier guardrails.
  R2_STORAGE_LIMIT_BYTES: z.coerce.number().int().positive().default(Number("9900000000")), // 9.9 GB
  MAX_UPLOADS_PER_USER_PER_DAY: z.coerce.number().int().positive().default(50),
  MAX_AUDIO_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export const isPushConfigured = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
);

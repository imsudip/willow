import "./env-load.js";
import { z } from "zod";
import { DEFAULT_CLEANUP_MODEL, DEFAULT_TRANSCRIPTION_MODEL } from "@willow/shared";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  TRANSCRIPTION_MODEL: z.string().default(DEFAULT_TRANSCRIPTION_MODEL),
  CLEANUP_MODEL: z.string().default(DEFAULT_CLEANUP_MODEL),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  REMINDER_CRON: z.string().default("30 18 * * *"),
  // Must match the timezone used by .github/workflows/cron.yml so the
  // reminder's "today" boundary and the schedule agree.
  CRON_TIMEZONE: z.string().default("Asia/Kolkata"),
  CRON_SECRET: z.string().min(16),
  AUTH_SECRET: z.string().min(8),
  PUBLIC_ORIGIN: z.string().url().optional(),
  DATA_DIR: z.string().default("./data"),
  PORT: z.coerce.number().int().positive().default(8777),
  MIGRATIONS_DIR: z.string().optional(),

  // Postgres (Neon): injected as DATABASE_URL on the function runtime,
  // or from .env.local via `neon env pull` locally.
  DATABASE_URL: z.string().min(1),

  // Cloudflare R2 (audio storage + presigned URLs).
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_API_TOKEN: z.string().min(1), // Cloudflare API token with R2 read (usage checks)
  R2_BUCKET: z.string().default("willow-audio"),

  // Free-tier guardrails: reject new audio uploads beyond these.
  R2_STORAGE_LIMIT_BYTES: z.coerce.number().int().positive().default(Number("9900000000")), // 9.9 GB
  MAX_UPLOADS_PER_USER_PER_DAY: z.coerce.number().int().positive().default(50),
  // Server-side cap for a single audio upload, enforced via presigned PUT
  // Content-Length. ~10 min of WebM speech at ~48 kbps.
  MAX_AUDIO_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export const isPushConfigured = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
);

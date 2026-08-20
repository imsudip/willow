import "dotenv/config";
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
  AUTH_SECRET: z.string().min(8).default(() => randomSecret()),
  PUBLIC_ORIGIN: z.string().url().optional(),
  DATA_DIR: z.string().default("./data"),
  PORT: z.coerce.number().int().positive().default(8777),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export const isPushConfigured = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
);

function randomSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

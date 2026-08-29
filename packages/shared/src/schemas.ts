import { z } from "zod";
import { MOODS, PROMPT_COUNT } from "./constants.js";

/** A single entry as stored locally (IndexedDB) and synced to the server. */
export const entrySchema = z.object({
  id: z.string().uuid(),
  recordedAt: z.string().datetime(), // ISO
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  audioPresent: z.boolean(), // audio blob exists locally
  audioDurationMs: z.number().int().min(0),
  rawTranscript: z.string().default(""),
  cleanedBody: z.string().default(""),
  title: z.string().default(""),
  mood: z.enum(MOODS).nullable().default(null),
  tags: z.array(z.string().max(24)).max(12).default([]),
  status: z
    .enum(["recording", "transcribing", "cleaning", "ready", "error"])
    .default("recording"),
  errorMessage: z.string().nullable().default(null),
  dirty: z.boolean().default(true), // local-only: needs sync
  deleted: z.boolean().default(false), // soft delete, synced
  serverAudioUrl: z.string().nullable().default(null),
});
export type Entry = z.infer<typeof entrySchema>;

/** Sync: batch push of local dirty entries. */
export const syncPushSchema = z.object({
  entries: z.array(entrySchema.omit({ dirty: true })).max(50),
});
export type SyncPush = z.infer<typeof syncPushSchema>;

/** Sync: pull changes after a timestamp. */
export const syncPullSchema = z.object({
  since: z.string().datetime().optional(),
});
export type SyncPull = z.infer<typeof syncPullSchema>;

/** One synced entry as returned by the API. */
export const apiEntrySchema = entrySchema.omit({ dirty: true });
export type ApiEntry = z.infer<typeof apiEntrySchema>;

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type AuthInput = z.infer<typeof authSchema>;

export const cleanupOutputSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1),
  mood: z.enum(MOODS).nullable(),
  tags: z.array(z.string().min(1).max(24)).max(12),
});
export type CleanupOutput = z.infer<typeof cleanupOutputSchema>;

export const promptSchema = z.object({
  question: z.string().min(1).max(200),
  sourceHint: z.string().max(80).nullable().default(null), // e.g. "about your run on Jul 12"
});
export const promptsResponseSchema = z.object({
  questions: z.array(promptSchema).max(PROMPT_COUNT),
});
export type Prompt = z.infer<typeof promptSchema>;

export const weeklyDigestSchema = z.object({
  summary: z.string().min(1),
  themes: z.array(z.string().min(1).max(60)).max(6),
  reflectionPrompt: z.string().min(1).max(200).nullable(),
});
export type WeeklyDigest = z.infer<typeof weeklyDigestSchema>;

export const settingsSchema = z.object({
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).default("18:30"),
  chimesEnabled: z.boolean().default(true),
  appearance: z.enum(["light", "dark", "system"]).default("system"),
});
export type Settings = z.infer<typeof settingsSchema>;

/**
 * Server-side per-user config. One row per user in `user_config`.
 * `openaiApiKeyEnc` holds the user's BYO OpenAI key, symmetrically encrypted
 * with an app secret — never plaintext, and never returned to the client
 * (the client only sees `openaiKeyConfigured`).
 */
export const userConfigSchema = z.object({
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).default("18:30"),
  chimesEnabled: z.boolean().default(true),
  appearance: z.enum(["light", "dark", "system"]).default("system"),
  openaiKeyConfigured: z.boolean().default(false),
});
export type UserConfig = z.infer<typeof userConfigSchema>;

/** Body for updating config (key is a separate field so it's never echoed). */
export const userConfigUpdateSchema = userConfigSchema
  .omit({ openaiKeyConfigured: true })
  .partial();
export type UserConfigUpdate = z.infer<typeof userConfigUpdateSchema>;

/** Body for setting/clearing the user's OpenAI key. */
export const openaiKeyUpdateSchema = z.object({
  apiKey: z.string().min(1).max(512).nullable(),
});
export type OpenaiKeyUpdate = z.infer<typeof openaiKeyUpdateSchema>;

/** Server response for GET /api/user/config (never contains the key). */
export const userConfigResponseSchema = userConfigSchema.extend({
  openaiKeyConfigured: z.boolean(),
});
export type UserConfigResponse = z.infer<typeof userConfigResponseSchema>;

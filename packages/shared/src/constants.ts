/** Shared constants for Willow. Kept in one place so the app and API never drift. */

/** Max recording length in ms (10 minutes). MediaRecorder enforces this. */
export const MAX_RECORDING_MS = 10 * 60 * 1000;

/** Min recording length in ms below which an entry is rejected. */
export const MIN_RECORDING_MS = 1000;

/** Max audio upload size in bytes (25 MB). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Max number of questions shown on the Today screen. */
export const PROMPT_COUNT = 3;

/** Server-side transcription model (Wispr Flow / OpenAI Realtime). */
export const DEFAULT_TRANSCRIPTION_MODEL = "gpt-live-transcribe";

/** Fallback transcription model used by the batch (file) path. */
export const FALLBACK_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** Default AI model for cleanup, prompts, and digest. */
export const DEFAULT_CLEANUP_MODEL = "gpt-4o-mini";

/** Minimum entries before personalized prompts kick in. */
export const PROMPT_MIN_ENTRIES = 2;

/** Entries considered for the prompt/digest context window. */
export const PROMPT_CONTEXT_ENTRIES = 10;
export const DIGEST_CONTEXT_ENTRIES = 30;

/** Bytes of the cleaned body sent as context (keeps tokens low). */
export const CONTEXT_BODY_CHARS = 300;

/** Server rate limit: max transcription minutes per user per day. */
export const MAX_TRANSCRIPTION_MINUTES_PER_DAY = 30;

/** Age in days after which a synced audio file is pruned from the server. */
export const SERVER_AUDIO_RETENTION_DAYS = 90;

export const MOODS = [
  "calm",
  "grateful",
  "tired",
  "anxious",
  "happy",
  "sad",
  "energetic",
  "stressed",
  "hopeful",
  "neutral",
] as const;
export type Mood = (typeof MOODS)[number];

export const ENTRY_STATUSES = [
  "recording",
  "transcribing",
  "cleaning",
  "ready",
  "error",
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Chunk size for streaming PCM16 audio to the transcription socket. */
export const PCM_CHUNK_MS = 250;
export const PCM_RATE = 24000;

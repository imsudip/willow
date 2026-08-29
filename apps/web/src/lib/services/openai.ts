import OpenAI from "openai";
import { env } from "../env";
import { resolveOpenaiKey } from "../user-config";

/**
 * Resolves the OpenAI client for a specific user: their BYO key if set,
 * otherwise the app-level key. Returns null when no key is available (the
 * caller decides whether to fall back or error).
 */
export async function openaiClientFor(userId: string): Promise<OpenAI | null> {
  const userKey = await resolveOpenaiKey(userId);
  const key = userKey ?? env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-placeholder")) return null;
  return new OpenAI({ apiKey: key });
}

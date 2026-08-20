import {
  CONTEXT_BODY_CHARS,
  PROMPT_CONTEXT_ENTRIES,
  PROMPT_MIN_ENTRIES,
  type Prompt,
} from "@willow/shared";
import { env } from "../env.js";
import { aiAvailable, openai } from "./openai.js";
import type { PromptSource } from "./prompt-sources.js";

const PROMPT_SYSTEM = `You are a thoughtful friend helping someone journal at the end of the day.

You will receive a list of recent journal entries (title, mood, tags, and a short excerpt) with how many days ago each was written.

Find 2-3 open threads worth checking in on:
- Plans or goals mentioned but not followed up
- People or situations the writer said they'd revisit
- Recurring moods or worries that might have shifted
- Positive things worth savoring or celebrating

Phrase each as a short, warm, first-person question the writer can answer by rambling. Ground every question in a real detail from the entries — never generic. Keep each question under 200 characters. For each question include a "sourceHint" of at most 80 characters describing the related entry (e.g. "about your run on Jul 12").

Respond with valid JSON only:
{ "questions": [ { "question": string, "sourceHint": string | null } ] }`;

export interface PromptContextEntry {
  title: string;
  mood: string | null;
  tags: string[];
  excerpt: string;
  daysAgo: number;
}

export const FALLBACK_PROMPTS: Prompt[] = [
  { question: "What's one thing you're looking forward to?", sourceHint: null },
  { question: "What drained your energy today, and what gave it back?", sourceHint: null },
  { question: "If you could redo one moment today, what would you change?", sourceHint: null },
];

export async function generatePrompts(
  history: PromptContextEntry[],
): Promise<{ questions: Prompt[]; usedFallback: boolean }> {
  if (history.length < PROMPT_MIN_ENTRIES || !aiAvailable()) {
    return { questions: FALLBACK_PROMPTS, usedFallback: true };
  }

  const context = history
    .slice(0, PROMPT_CONTEXT_ENTRIES)
    .map(
      (e) =>
        `- ${e.daysAgo === 0 ? "today" : `${e.daysAgo} day${e.daysAgo === 1 ? "" : "s"} ago`} | title: ${e.title || "(untitled)"} | mood: ${e.mood ?? "unknown"} | tags: ${e.tags.join(", ") || "none"} | excerpt: ${e.excerpt}`,
    )
    .join("\n");

  const completion = await openai.responses.create({
    model: env.CLEANUP_MODEL,
    instructions: PROMPT_SYSTEM,
    input: context,
    text: {
      format: {
        type: "json_schema",
        name: "daily_prompts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  sourceHint: { type: ["string", "null"] },
                },
                required: ["question", "sourceHint"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = completion.output_text?.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!raw) return { questions: FALLBACK_PROMPTS, usedFallback: true };
  try {
    const parsed = JSON.parse(raw) as { questions: Prompt[] };
    const questions = parsed.questions.slice(0, 3);
    if (questions.length === 0) return { questions: FALLBACK_PROMPTS, usedFallback: true };
    return { questions, usedFallback: false };
  } catch {
    return { questions: FALLBACK_PROMPTS, usedFallback: true };
  }
}

export { PROMPT_SYSTEM };
export type { PromptSource };

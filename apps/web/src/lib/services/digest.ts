import { DIGEST_CONTEXT_ENTRIES, type WeeklyDigest } from "@willow/shared";
import { env } from "../env";
import { aiAvailable, openai } from "./openai";

const DIGEST_SYSTEM = `You are a thoughtful journaling companion. Given a week of journal entries (title, mood, tags, excerpt), write a weekly digest.

Return valid JSON only:
{ "summary": string, "themes": string[], "reflectionPrompt": string | null }

- summary: 3-5 sentences weaving the week together: what happened, what shifted, recurring feelings.
- themes: up to 6 short theme labels (max 60 chars each).
- reflectionPrompt: one gentle question (max 200 chars) for next week, or null.`;

export async function generateWeeklyDigest(
  entries: { title: string; mood: string | null; tags: string[]; excerpt: string }[],
): Promise<WeeklyDigest> {
  if (!aiAvailable()) throw new Error("OpenAI is not configured");

  const context = entries
    .slice(0, DIGEST_CONTEXT_ENTRIES)
    .map(
      (e) =>
        `- title: ${e.title || "(untitled)"} | mood: ${e.mood ?? "unknown"} | tags: ${e.tags.join(", ") || "none"} | excerpt: ${e.excerpt}`,
    )
    .join("\n");

  const completion = await openai.responses.create({
    model: env.CLEANUP_MODEL,
    instructions: DIGEST_SYSTEM,
    input: context,
    text: {
      format: {
        type: "json_schema",
        name: "weekly_digest",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            themes: { type: "array", items: { type: "string" } },
            reflectionPrompt: { type: ["string", "null"] },
          },
          required: ["summary", "themes", "reflectionPrompt"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = completion.output_text?.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!raw) throw new Error("Empty digest response");
  const parsed = JSON.parse(raw) as WeeklyDigest;
  return {
    summary: parsed.summary,
    themes: (parsed.themes ?? []).slice(0, 6),
    reflectionPrompt: parsed.reflectionPrompt ?? null,
  };
}

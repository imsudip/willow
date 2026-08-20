import { cleanupOutputSchema, type CleanupOutput } from "@willow/shared";
import { env } from "../env.js";
import { aiAvailable, openai } from "./openai.js";

const CLEANUP_SYSTEM = `You are an expert journal editor. Your job is to turn a raw, rambling voice transcript into a clean journal entry.

Rules:
- Keep the writer's first-person voice and honest tone. Do not add events or feelings that are not in the transcript.
- Remove filler words ("um", "uh", "like", false starts, repetitions) and fix grammar.
- Organize the text into short paragraphs of 2-4 sentences each. Keep the natural order of what was said.
- The title should be a short phrase (max 8 words) that captures the heart of the entry.
- The mood must be one of: calm, grateful, tired, anxious, happy, sad, energetic, stressed, hopeful, neutral.
- Tags: 2-5 short lowercase tags (max 24 chars each).
- Respond with valid JSON only, matching this schema:
{ "title": string, "body": string, "mood": "calm"|"grateful"|"tired"|"anxious"|"happy"|"sad"|"energetic"|"stressed"|"hopeful"|"neutral"|null, "tags": string[] }`;

export async function cleanupTranscript(transcript: string): Promise<CleanupOutput> {
  if (!aiAvailable()) {
    throw new Error("OpenAI is not configured");
  }
  const completion = await openai.responses.create({
    model: env.CLEANUP_MODEL,
    instructions: CLEANUP_SYSTEM,
    input: transcript,
    text: {
      format: {
        type: "json_schema",
        name: "cleanup_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            mood: {
              type: ["string", "null"],
              enum: [
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
              ],
            },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["title", "body", "mood", "tags"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = completion.output_text;
  if (!text) throw new Error("Empty cleanup response");
  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  return cleanupOutputSchema.parse(JSON.parse(cleaned));
}

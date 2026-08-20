import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cleanupOutputSchema, entrySchema } from "./schemas.js";

describe("entrySchema", () => {
  it("accepts a minimal entry", () => {
    const now = new Date().toISOString();
    const entry = entrySchema.parse({
      id: randomUUID(),
      recordedAt: now,
      updatedAt: now,
      createdAt: now,
      audioPresent: true,
      audioDurationMs: 1000,
      status: "recording",
    });
    expect(entry.rawTranscript).toBe("");
    expect(entry.dirty).toBe(true);
    expect(entry.tags).toEqual([]);
  });

  it("rejects a bad mood", () => {
    const now = new Date().toISOString();
    expect(() =>
      entrySchema.parse({
        id: randomUUID(),
        recordedAt: now,
        updatedAt: now,
        createdAt: now,
        audioPresent: false,
        audioDurationMs: 0,
        mood: "ecstatic",
      }),
    ).toThrow();
  });
});

describe("cleanupOutputSchema", () => {
  it("parses a valid cleanup output", () => {
    const out = cleanupOutputSchema.parse({
      title: "A long day",
      body: "Paragraph one.\n\nParagraph two.",
      mood: "tired",
      tags: ["work", "family"],
    });
    expect(out.title).toBe("A long day");
    expect(out.tags).toHaveLength(2);
  });

  it("accepts a null mood", () => {
    const out = cleanupOutputSchema.parse({
      title: "No mood",
      body: "Body",
      mood: null,
      tags: [],
    });
    expect(out.mood).toBeNull();
  });
});

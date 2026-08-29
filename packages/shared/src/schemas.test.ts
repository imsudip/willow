import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cleanupOutputSchema,
  entrySchema,
  openaiKeyUpdateSchema,
  userConfigSchema,
  userConfigUpdateSchema,
} from "./schemas.js";

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

describe("userConfigSchema", () => {
  it("defaults the config", () => {
    const cfg = userConfigSchema.parse({});
    expect(cfg.reminderTime).toBe("18:30");
    expect(cfg.chimesEnabled).toBe(true);
    expect(cfg.appearance).toBe("system");
    expect(cfg.openaiKeyConfigured).toBe(false);
  });

  it("rejects a bad reminder time", () => {
    expect(() => userConfigSchema.parse({ reminderTime: "6:30pm" })).toThrow();
  });
});

describe("userConfigUpdateSchema", () => {
  it("allows a partial update without the key flag", () => {
    const patch = userConfigUpdateSchema.parse({ appearance: "dark" });
    expect(patch.appearance).toBe("dark");
    // The update body must never carry the "configured" flag.
    expect("openaiKeyConfigured" in patch).toBe(false);
  });
});

describe("openaiKeyUpdateSchema", () => {
  it("accepts a key or null (to clear)", () => {
    expect(openaiKeyUpdateSchema.parse({ apiKey: "sk-abc" }).apiKey).toBe("sk-abc");
    expect(openaiKeyUpdateSchema.parse({ apiKey: null }).apiKey).toBeNull();
  });
});

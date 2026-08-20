import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Smoke tests against the Hono app with an in-memory approach:
// we can't easily swap the sqlite file at runtime, so these use the real
// data dir but unique emails per run.
describe("API smoke", () => {
  const email = `smoke-${Date.now()}@willow.test`;
  let cookies = "";

  beforeAll(async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });

  it("signs up and gets a session", async () => {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123", name: "Smoke" }),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookies = setCookie.split(";")[0];
    expect(cookies).toContain("better-auth");
  });

  it("returns fallback prompts with no entries", async () => {
    const res = await app.request("/api/prompts/daily", {
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { questions: { question: string }[] };
    expect(body.questions.length).toBeGreaterThan(0);
    expect(body.questions[0].question).toBeTruthy();
  });

  it("rejects transcribe without a session", async () => {
    const res = await app.request("/api/transcribe", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects cleanup without a session", async () => {
    const res = await app.request("/api/transcribe/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "hi" }),
    });
    expect(res.status).toBe(401);
  });
});

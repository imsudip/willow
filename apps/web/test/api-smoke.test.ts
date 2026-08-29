import { beforeAll, describe, expect, it } from "vitest";
import { POST as authHandler } from "../src/app/api/auth/[...all]/route";
import { GET as promptsDaily } from "../src/app/api/prompts/daily/route";
import { GET as health } from "../src/app/api/health/route";
import { GET as entriesList } from "../src/app/api/entries/route";
import { POST as transcribe } from "../src/app/api/transcribe/route";
import { POST as cleanup } from "../src/app/api/transcribe/cleanup/route";

/**
 * Route Handler smoke tests. Next.js Route Handlers are plain functions taking
 * a Request and returning a Response, so we can invoke them directly. These
 * hit a real Postgres (DATABASE_URL from .env.local / CI) and exercise the
 * Better Auth flow end-to-end, matching the old Hono smoke tests.
 */
describe("API smoke (Next.js Route Handlers)", () => {
  const email = `smoke-${Date.now()}@willow.test`;
  let cookies = "";

  beforeAll(async () => {
    const res = await health();
    expect(res.status).toBe(200);
  });

  it("signs up and gets a session", async () => {
    const res = await authHandler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123", name: "Smoke" }),
      }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookies = setCookie.split(";")[0];
    expect(cookies).toContain("willow.session_token");
  });

  it("returns fallback prompts with no entries", async () => {
    const res = await promptsDaily(
      new Request("http://localhost:3000/api/prompts/daily", {
        headers: { Cookie: cookies },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { questions: { question: string }[] };
    expect(body.questions.length).toBeGreaterThan(0);
    expect(body.questions[0].question).toBeTruthy();
  });

  it("lists entries (empty for a new user)", async () => {
    const res = await entriesList(
      new Request("http://localhost:3000/api/entries", {
        headers: { Cookie: cookies },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("rejects transcribe without a session", async () => {
    const res = await transcribe(
      new Request("http://localhost:3000/api/transcribe", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects cleanup without a session", async () => {
    const res = await cleanup(
      new Request("http://localhost:3000/api/transcribe/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "hi" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

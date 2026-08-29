import { test, expect } from "@playwright/test";

/**
 * Core auth + app journey. Uses a unique email per run so tests are
 * repeatable against a shared dev/prod database.
 */
test.describe("Willow auth journey", () => {
  const email = `e2e-${Date.now()}@willow.test`;
  const password = "password123";

  test("signs up, explores the app, signs out, signs back in", async ({
    page,
  }) => {
    // ── 0 · Warm up the catch-all route (dev first-compile is slow; the
    // signup reloads the page, so the route must already be compiled) ──
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New here? Create an account" }),
      { timeout: 30_000 },
    ).toBeVisible();

    // ── 1 · Login screen renders (SPA hydrated) ──
    await page.getByRole("button", { name: "New here? Create an account" }).click();

    // ── 2 · Create account ──
    await page.getByPlaceholder("What should we call you?").fill("E2E Tester");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("8+ characters").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // ── 3 · Lands on Today (the signup does a full page reload + the SPA
    // re-mounts via dynamic(ssr:false); in dev this can be slow on first
    // compile, so allow a generous timeout. Assert on the record button which
    // is always present once authenticated.)
    await expect(page.getByRole("button", { name: /Start recording/ }), {
      timeout: 45_000,
    }).toBeVisible();

    // ── 4 · Entries (empty state) ──
    await page.getByRole("link", { name: "Entries" }).click();
    await expect(page.getByText("No entries yet")).toBeVisible();

    // ── 5 · Stats ──
    await page.getByRole("link", { name: "Stats" }).click();
    await expect(page.getByRole("heading", { name: "Stats" })).toBeVisible();

    // ── 6 · Settings shows the signed-in user ──
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // ── 6.5 · BYO OpenAI key: set + verify "configured", then clear ──
    await expect(page.getByText("OpenAI key (optional)")).toBeVisible();
    await page.getByPlaceholder("sk-…").fill("sk-e2e-test-key-1234567890");
    await page.getByRole("button", { name: "Save key" }).click();
    await expect(page.getByText(/Key saved/)).toBeVisible();
    // Clear it again so the E2E user doesn't hold a (fake) key.
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Key removed.")).toBeVisible();

    // ── 7 · Sign out → back to login ──
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "New here? Create an account" }),
      { timeout: 45_000 },
    ).toBeVisible();

    // ── 8 · Sign back in (account persisted) — sign-in stays on the current
    // route (Settings from step 6), so assert the authenticated state there.
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("8+ characters").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("E2E Tester"), { timeout: 45_000 }).toBeVisible();
  });
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Willow E2E tests (Playwright).
 *
 * These hit a REAL running app — either the local Next dev server or a
 * deployed URL — so they exercise the full user journey (signup → Today →
 * entries → settings → signout) through a browser, including cookies, the
 * service worker, and same-origin /api calls.
 *
 * Usage:
 *   npm run test:e2e            # assumes a server already running on :3000
 *   PW_BASE_URL=https://... npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

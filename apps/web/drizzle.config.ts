import { defineConfig } from "drizzle-kit";
// Load the repo-root .env.local (same mechanism as the Next.js app), so
// drizzle-kit picks up DATABASE_URL from the single Willow env file.
import "./src/lib/env-load";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});

import { migrate as runMigrations } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index.js";

// Creates tables if the DB is fresh, applies new migrations otherwise.
// Safe to run on every server start.
export function migrate() {
  runMigrations(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
}

export function closeDb() {
  sqlite.close();
}

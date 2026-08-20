import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../env.js";
import * as schema from "./schema.js";

const dataDir = resolve(process.cwd(), env.DATA_DIR);
mkdirSync(dataDir, { recursive: true });

export const sqlite = new Database(resolve(dataDir, "willow.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export { schema };

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

// Pooled connection (DATABASE_URL is injected by Neon on the function runtime;
// locally it comes from .env.local via `neon env pull` / dotenv).
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
});

export const db = drizzle(pool, { schema });

export { schema };

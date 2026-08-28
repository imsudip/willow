import { attachDatabasePool } from "@neon/functions";
import { pool } from "./db/index.js";
import app from "./app.js";

// Neon Functions runtime: keep the pg pool alive across requests and
// swallow expected idle disconnects (scale-to-zero / pooler reclaims).
attachDatabasePool(pool);

export default app;

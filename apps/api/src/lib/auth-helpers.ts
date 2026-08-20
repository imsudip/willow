import type { Context } from "hono";
import { auth } from "../auth.js";

export async function getSessionUser(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

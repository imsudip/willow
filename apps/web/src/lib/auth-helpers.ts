import { headers } from "next/headers";
import { auth } from "./auth-server";

/** Returns the session user from the incoming request's cookies/headers. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

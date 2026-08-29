import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "./env";
import { db, schema } from "./db/index";

/**
 * Better Auth, same-origin (Next.js serves the app AND the API). No CORS /
 * trusted-origins list needed anymore — the previous split required them.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.AUTH_SECRET,
  baseURL: env.PUBLIC_ORIGIN,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    useSecureCookies: true,
    cookiePrefix: "willow",
  },
});

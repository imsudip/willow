import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "./env";
import { db, schema } from "./db/index";

/**
 * Better Auth, same-origin (Next.js serves the app AND the API). No CORS
 * needed anymore, but Better Auth still validates the request Origin against
 * baseURL/trustedOrigins — so dev (localhost) and the configured production
 * origin must both be trusted.
 */
const trustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(env.PUBLIC_ORIGIN ? [env.PUBLIC_ORIGIN] : []),
];

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
  trustedOrigins,
  advanced: {
    useSecureCookies: true,
    cookiePrefix: "willow",
  },
});

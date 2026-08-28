import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "./env.js";
import { db, schema } from "./db/index.js";

// Trusted browser origins: the configured public origin (production) plus
// localhost dev servers (Vite on :5173 proxies /api to this API on :8777).
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const trustedOrigins = [
  ...DEV_ORIGINS,
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
    // Frontend (Vercel) and API (Neon Functions) are different origins in
    // production, so the session cookie must work cross-site.
    crossSubDomain: true,
    useSecureCookies: true,
    cookiePrefix: "willow",
  },
});

import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Single-user app. Only the e-mail address(es) in ALLOWED_EMAILS may sign in.
 * The check runs on user creation AND on every new session, so even an
 * account row that somehow exists cannot start a session unless allowlisted.
 */
const allowed = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function isAllowed(email: string | null | undefined) {
  return !!email && allowed.has(email.toLowerCase());
}

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
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  session: {
    // "Remember this device": a 60-day session, refreshed daily while in use.
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => (isAllowed(u.email) ? undefined : false),
      },
    },
    session: {
      create: {
        before: async (s) => {
          const [owner] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, s.userId))
            .limit(1);
          return isAllowed(owner?.email) ? undefined : false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});

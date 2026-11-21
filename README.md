# DG Work Hub — My Bookmarks

Private visual bookmark manager for The Design Guy, with one-click **Launch Workspace**.

Stack: Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Neon Postgres + Drizzle ORM · Better Auth (GitHub sign-in, single allowlisted user) · Vercel.

## Setup (one time)

1. **Vercel → Add New → Project** → import `The-Design-Guy/DG-Work-Hub`.
2. **Vercel project → Storage → Create → Neon** → connect it to this project (adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`).
3. **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL: `https://<your-domain>`
   - Callback URL: `https://<your-domain>/api/auth/callback/github`
4. **Vercel project → Settings → Environment Variables** — add the rest from `.env.example`:
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_EMAILS`.
5. Redeploy. Database migrations run automatically during the build.

## Security model

- Only e-mails in `ALLOWED_EMAILS` can create a user **or** start a session.
- `src/proxy.ts` only does an optimistic redirect; every page, action and API checks the session server-side (`requireUser`).
- Sessions last 60 days on a trusted device and are stored in the database, so they can be revoked.

## Scripts

- `npm run dev` — local dev (needs `.env.local`)
- `npm run db:generate` — create a migration after editing `src/db/schema.ts`
- `npm run db:migrate` — apply migrations

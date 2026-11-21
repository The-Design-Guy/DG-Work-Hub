import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic redirect only: sends visitors without a session cookie to /login.
 * Real authorization happens server-side (requireUser) on every page and API.
 */
export function proxy(request: NextRequest) {
  // Always use the one canonical address. Sign-in only works there, because
  // GitHub redirects back to it and Better Auth rejects other origins.
  const canonical = process.env.BETTER_AUTH_URL;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (canonical && host.endsWith(".vercel.app")) {
    const target = new URL(canonical);
    if (host !== target.host) {
      const url = new URL(request.nextUrl.pathname + request.nextUrl.search, target);
      return NextResponse.redirect(url, 308);
    }
  }
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth")) return NextResponse.next();
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|robots.txt).*)",
  ],
};

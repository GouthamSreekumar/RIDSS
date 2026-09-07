/**
 * Next.js Edge Middleware — route protection.
 *
 * Behavior:
 * - Checks for the presence of the 'ridss_access_token' cookie on all
 *   protected routes (/admin/**, /team-manager/**, etc.).
 * - If the cookie is absent → redirect to /login.
 * - If an authenticated user hits /login → redirect to / (role routing
 *   happens client-side via the /me API call in app/page.tsx).
 * - Does NOT decode the JWT — that would require 'jose' + JWT_SECRET in
 *   the edge runtime, which is a larger attack surface. The backend
 *   re-validates the JWT on every API call. This middleware is the
 *   UX-layer guard only.
 *
 * Judgment call: Edge middleware is intentionally lightweight. True
 * authorization (role checks, permission enforcement) lives in the
 * backend FastAPI layer and page-level /me queries. This is consistent
 * with the Next.js enterprise pattern: middleware handles routing UX,
 * backend handles security.
 *
 * Note: The /(protected) route group is a Next.js App Router convention.
 * The parentheses prevent the segment name from appearing in the URL.
 */
import { type NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "ridss_access_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthCookie = request.cookies.has(AUTH_COOKIE);

  // ── /login: never block unauthenticated users from reaching it ─────────────
  // An authenticated user on /login is redirected to / (root page calls /me
  // and routes them to their role dashboard).
  if (pathname === "/login") {
    if (hasAuthCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // No cookie — let unauthenticated user stay on login page
    return NextResponse.next();
  }

  // ── Protected routes: require auth cookie ──────────────────────────────────
  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all role dashboards
    "/admin/:path*",
    "/team-manager/:path*",
    "/race-engineer/:path*",
    "/strategy-engineer/:path*",
    "/mechanic/:path*",
    "/driver/:path*",
    // Run on /login so authenticated users are bounced to their dashboard
    "/login",
  ],
};

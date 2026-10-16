import { NextResponse, type NextRequest } from "next/server";
import { AGENT_COOKIE, SESSION_COOKIE, isValidSessionToken, readAgentToken } from "@/lib/session";

/**
 * First line of defence for /admin and /agent: signed-out visitors go to the right login page.
 * This only checks the cookie signature; every page and action also checks the session itself
 * (lib/auth.ts), including whether an agent is still active.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const loggedIn = await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    const onLogin = pathname === "/admin/login";
    if (!loggedIn && !onLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
    if (loggedIn && onLogin) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (pathname === "/agent" || pathname.startsWith("/agent/")) {
    const onLogin = pathname === "/agent/login";
    const claims = await readAgentToken(request.cookies.get(AGENT_COOKIE)?.value);
    if (onLogin) {
      // Signed in already? Skip to the dashboard — unless the app just signed them out
      // (deactivated or password reset), in which case ?signedout keeps them here.
      if (claims && !request.nextUrl.searchParams.has("signedout")) {
        return NextResponse.redirect(new URL("/agent", request.url));
      }
      return NextResponse.next();
    }
    if (!claims) return NextResponse.redirect(new URL("/agent/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/agent", "/agent/:path*"],
};

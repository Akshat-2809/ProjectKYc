import { NextResponse } from "next/server";
import { endAdminSession } from "@/lib/auth";

/**
 * Sign-out is a plain form POST to this route (not a server action), so the browser does a
 * full page load afterwards. That clears every page the app kept alive in the background,
 * including the login form's "signed in" state.
 */
export async function POST(request: Request) {
  await endAdminSession();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}

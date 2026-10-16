import { NextResponse } from "next/server";
import { endAgentSession } from "@/lib/auth";

/** Full-page sign-out for agents (see api/admin/logout for why it isn't a server action). */
export async function POST(request: Request) {
  await endAgentSession();
  return NextResponse.redirect(new URL("/agent/login", request.url), 303);
}

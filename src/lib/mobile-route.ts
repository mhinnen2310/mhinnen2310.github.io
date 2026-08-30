import { NextResponse } from "next/server";
import { MobileAuthError, requireMobileStaff } from "./mobile-auth";

/** Shared bearer guard for mobile-only route handlers. */
export async function mobileActor(req: Request) {
  try {
    return { actor: await requireMobileStaff(req.headers.get("authorization")), response: null };
  } catch (error) {
    return {
      actor: null,
      response: NextResponse.json(
        { error: error instanceof MobileAuthError ? error.message : "Niet geautoriseerd." },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

export function mobileError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400, headers: { "cache-control": "no-store" } });
}

export function mobileOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

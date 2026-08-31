import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { MobileAuthError, revokeMobileSession } from "@/lib/mobile-auth";
import { ipHashOf } from "@/lib/rate-limit";

/** Revoke only the calling handset; other staff devices remain signed in. */
export async function POST(req: Request) {
  const ipHash = await ipHashOf(req.headers);
  try {
    const revoked = await revokeMobileSession(req.headers.get("authorization"));
    await audit("mobile_auth.logout", "MobileSession", revoked.id, null, revoked.user, ipHash);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MobileAuthError ? error.message : "Uitloggen mislukt." }, { status: 401 });
  }
}

import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { refreshMobile, MobileAuthError } from "@/lib/mobile-auth";
import { ipHashOf, rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: { refreshToken?: unknown; deviceId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige sessie." }, { status: 400 }); }
  if (typeof body.refreshToken !== "string" || typeof body.deviceId !== "string" || body.refreshToken.length < 32 || body.deviceId.length < 16 || body.deviceId.length > 200) {
    return NextResponse.json({ error: "Ongeldige sessie." }, { status: 400 });
  }
  const ipHash = await ipHashOf(req.headers);
  const limit = await rateLimitRequest("mobile-refresh", [body.deviceId, ipHash ?? "no-ip"], 30, 10 * 60);
  if (!limit.allowed) return NextResponse.json({ error: "Te veel sessievernieuwingen. Log opnieuw in." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  try {
    const result = await refreshMobile(body.refreshToken, body.deviceId);
    await audit("mobile_auth.refresh_succeeded", "MobileSession", null, null, null, ipHash);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    await audit("mobile_auth.refresh_failed", "MobileSession", null, null, null, ipHash);
    return NextResponse.json({ error: error instanceof MobileAuthError ? error.message : "Sessie verlopen." }, { status: 401 });
  }
}

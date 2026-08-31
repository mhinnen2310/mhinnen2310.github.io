import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { loginMobile, MobileAuthError } from "@/lib/mobile-auth";
import { ipHashOf, rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown; deviceId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige inloggegevens." }, { status: 400 }); }
  if (typeof body.email !== "string" || typeof body.password !== "string" || typeof body.deviceId !== "string" || body.deviceId.length < 16 || body.deviceId.length > 200) {
    return NextResponse.json({ error: "Ongeldige inloggegevens." }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  const ipHash = await ipHashOf(req.headers);
  const limit = await rateLimitRequest("mobile-login", [email, ipHash ?? "no-ip"], 5, 10 * 60);
  if (!limit.allowed) return NextResponse.json({ error: "Te veel inlogpogingen. Probeer het later opnieuw." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  try {
    const result = await loginMobile(email, body.password, body.deviceId);
    await audit("mobile_auth.login_succeeded", "MobileSession", null, null, result.user, ipHash);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    await audit("mobile_auth.login_failed", "MobileSession", null, null, null, ipHash);
    return NextResponse.json({ error: error instanceof MobileAuthError ? error.message : "Inloggen mislukt." }, { status: 401 });
  }
}

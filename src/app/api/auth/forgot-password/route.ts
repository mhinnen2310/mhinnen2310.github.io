import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/account";
import { ipHashOf } from "@/lib/rate-limit";

/**
 * Always returns success — never reveals whether an e-mail exists.
 */
export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const ip = await ipHashOf(req.headers);
  await requestPasswordReset(body.email, ip).catch((err) => console.error("forgot-password failed", err));
  return NextResponse.json({
    ok: true,
    message: "Als er een account met dat e-mailadres bestaat, heb je een link ontvangen om je wachtwoord te herstellen.",
  });
}

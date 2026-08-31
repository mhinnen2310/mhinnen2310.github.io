import { NextResponse } from "next/server";
import { processProviderWebhook } from "@/lib/checkout";
import { isMockEnabled } from "@/lib/payments/mock";

/**
 * Mock provider webhook (development & E2E only).
 * Refused outright in production (isMockEnabled checks env + NODE_ENV).
 */
export async function POST(req: Request) {
  if (!isMockEnabled()) {
    return NextResponse.json({ error: "Niet beschikbaar." }, { status: 404 });
  }
  let payload: unknown;
  const text = await req.text();
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  const result = await processProviderWebhook("mock", payload);
  if (result.outcome === "error") {
    console.error("mock webhook error:", result.detail);
    return NextResponse.json({ ok: false, detail: result.detail }, { status: 400 });
  }
  return NextResponse.json({ ok: true, outcome: result.outcome }, { status: 200 });
}

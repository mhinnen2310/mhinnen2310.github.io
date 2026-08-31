import { NextResponse } from "next/server";
import { processProviderWebhook } from "@/lib/checkout";
import { parseMollieWebhookBody } from "@/lib/payments/mollie-webhook";

/**
 * Mollie webhook endpoint.
 *
 * Security (Invariant 9): the raw body is only an EVENT NOTIFICATION.
 * `processProviderWebhook` re-fetches the payment over the authenticated
 * Mollie API before any state change, and the WebhookEvent ledger makes
 * processing idempotent.
 *
 * Status codes: 2xx = processed/known-ignored (Mollie stops retrying),
 * 400 = permanently invalid (unknown payment / bad shape),
 * 500 = transient error (Mollie retries with backoff).
 */
export async function POST(req: Request) {
  const text = await req.text();
  const payload = parseMollieWebhookBody(text, req.headers.get("content-type"));
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Ongeldige Mollie-webhook." }, { status: 400 });
  }

  const result = await processProviderWebhook("mollie", payload);

  if (result.outcome === "error" && /Onbekende betaling|unknown payment|Ongeldige|provider/i.test(result.detail ?? "")) {
    return NextResponse.json({ ok: false, outcome: result.outcome, detail: result.detail }, { status: 400 });
  }
  if (result.outcome === "error") {
    console.error("mollie webhook error:", result.detail);
    return NextResponse.json({ ok: false, outcome: result.outcome }, { status: 500 });
  }
  return NextResponse.json({ ok: true, outcome: result.outcome }, { status: 200 });
}

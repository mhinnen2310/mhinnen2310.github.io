import { NextResponse } from "next/server";
import { confirmManualPayment, OrderStateError } from "@/lib/orders";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";

/** Explicit staff attestation; it enters the same atomic sale completion as every other payment. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  let body: { method?: unknown; cashReceivedCents?: unknown; changeReturnedCents?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (body.method !== "CASH" && body.method !== "BANK_TRANSFER") return NextResponse.json({ error: "Kies CASH of BANK_TRANSFER." }, { status: 400 });
  const cents = (value: unknown) => value == null ? undefined : typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const cashReceivedCents = cents(body.cashReceivedCents), changeReturnedCents = cents(body.changeReturnedCents);
  if (cashReceivedCents === null || changeReturnedCents === null) return NextResponse.json({ error: "Bedragen moeten gehele eurocenten zijn." }, { status: 400 });
  try {
    const receipt = body.method === "CASH" ? { cashReceivedCents, changeReturnedCents } : undefined;
    return mobileOk({ result: await confirmManualPayment(id, body.method, actor, receipt) });
  } catch (error) {
    if (error instanceof OrderStateError) return mobileError(error, "Betaling kon niet worden bevestigd.");
    console.error("mobile manual payment confirmation failed", error); return NextResponse.json({ error: "Betaling kon niet worden bevestigd." }, { status: 500 });
  }
}

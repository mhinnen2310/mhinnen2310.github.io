import { NextResponse } from "next/server";
import { findOrderForGuest } from "@/lib/order-view";
import { rateLimitRequest, ipHashOf } from "@/lib/rate-limit";
import { isEmail } from "@/lib/forms";
import { createGuestInvoiceToken } from "@/lib/order-access";

/**
 * Guest order lookup: order number + e-mail (the e-mail must match the
 * order — otherwise nothing is revealed).
 */
export async function POST(req: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await ctx.params;
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (!isEmail(body.email)) {
    return NextResponse.json({ error: "Vul het e-mailadres in dat je bij de bestelling hebt gebruikt." }, { status: 400 });
  }

  const ip = await ipHashOf(req.headers);
  const rl = await rateLimitRequest("form", [orderNumber, body.email.trim().toLowerCase(), ip ?? "no-ip"], 10, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het over enkele minuten opnieuw." }, { status: 429 });
  }

  const order = await findOrderForGuest(orderNumber.trim().toUpperCase(), body.email);
  if (!order) {
    return NextResponse.json({ error: "Geen bestelling gevonden met dat bestelnummer en e-mailadres." }, { status: 404 });
  }
  return NextResponse.json(
    {
      ...order,
      invoiceAccessToken: createGuestInvoiceToken(order.orderNumber, body.email),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

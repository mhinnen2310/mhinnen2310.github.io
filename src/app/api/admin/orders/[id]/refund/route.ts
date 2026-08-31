import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { OrderStateError, refundOrder, type RefundedBikeDestination } from "@/lib/orders";

const DESTINATIONS = new Set<RefundedBikeDestination>(["WORKSHOP", "AVAILABLE", "ARCHIVED"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: { amountCents?: unknown; reason?: unknown; bikeDestination?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  const amountCents = body.amountCents == null ? null : typeof body.amountCents === "number" && Number.isSafeInteger(body.amountCents) ? body.amountCents : undefined;
  const reason = body.reason == null ? null : typeof body.reason === "string" && body.reason.trim().length <= 1000 ? body.reason.trim() || null : undefined;
  const bikeDestination = typeof body.bikeDestination === "string" && DESTINATIONS.has(body.bikeDestination as RefundedBikeDestination) ? body.bikeDestination as RefundedBikeDestination : undefined;
  if (amountCents === undefined || reason === undefined || !bikeDestination) return NextResponse.json({ error: "Controleer bedrag, reden en vervolgbestemming." }, { status: 400 });
  try {
    const result = await refundOrder(id, amountCents, reason, actor.id, { fullRefundBikeDestination: bikeDestination });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof OrderStateError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin refund failed", error);
    return NextResponse.json({ error: "Terugbetaling kon niet veilig worden verwerkt." }, { status: 500 });
  }
}

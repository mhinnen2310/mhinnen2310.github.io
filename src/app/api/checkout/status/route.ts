import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaymentStatusToken } from "@/lib/order-access";

/**
 * Minimal public status check used by the payment result page (polling).
 * Only reveals the payment state for the signed checkout capability. Order
 * numbers are sequential identifiers and must never be treated as secrets.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("order");
  const token = url.searchParams.get("token");
  if (!orderNumber || !verifyPaymentStatusToken(orderNumber, token)) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      paymentStatus: true,
      fulfilmentStatus: true,
      placedAt: true,
      paidAt: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  return NextResponse.json(order, { headers: { "cache-control": "no-store" } });
}

import { prisma } from "./prisma";
import type { Order, OrderLine, WarrantyRecord } from "@prisma/client";

/**
 * Public order views (customer account, guest lookup, payment result).
 *
 * Invariant 8: orders are immutable snapshots — these views only SELECT,
 * never recompute prices or re-read current product data.
 * Invariant 6: internalNotes / admin-only fields are never included.
 */

export interface PublicOrderLine {
  kind: "UNIQUE_BIKE" | "STOCK_ITEM";
  name: string;
  identifier: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  imageKey: string | null;
  bikeId: string | null;
  productId: string | null;
}

export interface PublicOrder {
  id: string;
  orderNumber: string;
  placedAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  paymentStatus: Order["paymentStatus"];
  fulfilmentStatus: Order["fulfilmentStatus"];
  subtotalCents: number;
  deliveryCostCents: number;
  taxTotalCents: number;
  totalCents: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string | null;
  billingLine1: string | null;
  billingCity: string | null;
  billingPostcode: string | null;
  billingCountry: string;
  deliveryMethod: string | null;
  deliveryLine1: string | null;
  deliveryCity: string | null;
  deliveryPostcode: string | null;
  lines: PublicOrderLine[];
  invoiceNumber: string | null;
  invoiceId: string | null;
  invoiceIssuedAt: Date | null;
  warranties: Pick<WarrantyRecord, "scope" | "description" | "startAt" | "endAt">[];
}

function toPublicOrder(order: Order & { lines: OrderLine[] }, invoice: { id: string; invoiceNumber: string; issuedAt: Date } | null, warranties: Pick<WarrantyRecord, "scope" | "description" | "startAt" | "endAt">[]): PublicOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    subtotalCents: order.subtotalCents,
    deliveryCostCents: order.deliveryCostCents,
    taxTotalCents: order.taxTotalCents,
    totalCents: order.totalCents,
    currency: order.currency,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerCompany: order.customerCompany,
    billingLine1: order.billingLine1,
    billingCity: order.billingCity,
    billingPostcode: order.billingPostcode,
    billingCountry: order.billingCountry,
    deliveryMethod: order.deliveryMethod,
    deliveryLine1: order.deliveryLine1,
    deliveryCity: order.deliveryCity,
    deliveryPostcode: order.deliveryPostcode,
    lines: order.lines.map((l) => ({
      kind: l.kind,
      name: l.name,
      identifier: l.identifier,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      lineTotalCents: l.lineTotalCents,
      imageKey: l.imageKey,
      bikeId: l.bikeId,
      productId: l.productId,
    })),
    invoiceNumber: invoice?.invoiceNumber ?? null,
    invoiceId: invoice?.id ?? null,
    invoiceIssuedAt: invoice?.issuedAt ?? null,
    warranties,
  };
}

async function loadPublicOrder(orderId: string): Promise<PublicOrder | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return null;
  const [invoice, warranties] = await Promise.all([
    prisma.invoice.findFirst({
      where: { orderId: order.id, status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
      select: { id: true, invoiceNumber: true, issuedAt: true },
    }),
    prisma.warrantyRecord.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return toPublicOrder(order, invoice, warranties);
}

export async function findOrderPublicByNumber(orderNumber: string): Promise<PublicOrder | null> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return null;
  return loadPublicOrder(order.id);
}

export async function findOrdersForUser(userId: string): Promise<PublicOrder[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take: 50,
  });
  const out: PublicOrder[] = [];
  for (const o of orders) {
    const p = await loadPublicOrder(o.id);
    if (p) out.push(p);
  }
  return out;
}

/** Guest lookup: the e-mail must match the order (IDOR protection). */
export async function findOrderForGuest(orderNumber: string, email: string): Promise<PublicOrder | null> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return null;
  const expected = order.customerEmail.trim().toLowerCase();
  if (email.trim().toLowerCase() !== expected) return null;
  return loadPublicOrder(order.id);
}

import { prisma } from "./prisma";
import { env } from "./env";
import { Prisma } from "@prisma/client";
import type { Bike, Order } from "@prisma/client";
import { getWarrantyScopes } from "./warranty";
import { getPaymentProvider } from "./payments";

/**
 * Order lifecycle.
 *
 * Payment and fulfilment are separate state machines (spec 29):
 *   payment:    PENDING -> PAID | FAILED | EXPIRED | CANCELLED | REFUNDED...
 *   fulfilment: UNFULFILLED -> PREPARING -> READY_FOR_PICKUP -> ... -> FULFILLED
 *
 * Concurrency rules (Invariant 3): a bike becomes SOLD only via the
 * atomic RESERVED -> SOLD transition in markOrderPaid, guarded by the
 * row-level status predicate. Two orders can never win the same bike.
 */

export class OrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStateError";
  }
}

function ttlMs(): number {
  return env.reservationTtlMinutes * 60_000;
}

export interface OrderWithRelations extends Order {
  lines: {
    id: string;
    kind: "UNIQUE_BIKE" | "STOCK_ITEM";
    bikeId: string | null;
    productId: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }[];
}

/** Release reservations (bikes back to AVAILABLE) and restock products. */
async function releaseOrderResourcesTx(
  tx: Prisma.TransactionClient,
  order: OrderWithRelations,
) {
  const released = await tx.reservation.updateMany({
    where: { orderId: order.id, status: "ACTIVE" },
    data: { status: "RELEASED" },
  });
  if (released.count > 0) {
    // Only bikes still in RESERVED state (never touch SOLD bikes)
    await tx.bike.updateMany({
      where: {
        status: "RESERVED",
        reservations: { some: { orderId: order.id, status: "RELEASED" } },
      },
      data: { status: "AVAILABLE" },
    });
  }
  for (const line of order.lines) {
    if (line.kind === "STOCK_ITEM" && line.productId) {
      await tx.product.update({
        where: { id: line.productId },
        data: { stockQuantity: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          change: line.quantity,
          reason: "order-cancel",
          reference: order.orderNumber,
        },
      });
    }
  }
}

export async function markOrderPaid(orderId: string, paidAt: Date | null = null): Promise<boolean> {
  let changed = false;
  await prisma.$transaction(async (tx) => {
    const order = (await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    })) as OrderWithRelations | null;
    if (!order) throw new OrderStateError("Bestelling niet gevonden");
    if (order.paymentStatus === "PAID") return; // idempotent
    if (order.paymentStatus !== "PENDING") {
      throw new OrderStateError(
        `Bestelling ${order.orderNumber} kan niet als betaald worden gemarkeerd (status ${order.paymentStatus})`,
      );
    }
    const now = paidAt ?? new Date();
    changed = true;
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", paidAt: now },
    });

    for (const line of order.lines) {
      if (line.kind !== "UNIQUE_BIKE" || !line.bikeId) continue;
      const bike = await tx.bike.findUnique({ where: { id: line.bikeId } });
      if (!bike) continue;
      if (bike.status !== "RESERVED") continue; // already handled

      const warranties = await buildWarrantyRecords(bike, now, order);
      if (warranties.length > 0) {
        await tx.warrantyRecord.createMany({
          data: warranties.map((w) => ({
            orderId: order.id,
            orderNumber: order.orderNumber,
            ...w,
          })),
        });
      }

      // ATOMIC guarded transition: only one winner per physical bike.
      const lastWarranty = warranties[warranties.length - 1];
      const updated = await tx.bike.updateMany({
        where: { id: line.bikeId, status: "RESERVED" },
        data: {
          status: "SOLD",
          soldAt: now,
          soldOrderNumber: order.orderNumber,
          warrantyStart: now,
          warrantyEnd: lastWarranty ? lastWarranty.endAt : null,
          realisedSalePriceCents: line.unitPriceCents,
        },
      });
      if (updated.count === 1) {
        await tx.reservation.updateMany({
          where: { orderId: order.id, bikeId: line.bikeId, status: "ACTIVE" },
          data: { status: "CONVERTED_TO_ORDER" },
        });
      }
    }
  });
  return changed;
}

async function buildWarrantyRecords(
  bike: Bike,
  saleDate: Date,
  order: { id: string; orderNumber: string },
) {
  const scopes = await getWarrantyScopes();
  const records: { scope: string; description: string; startAt: Date; endAt: Date }[] = [];
  const addMonths = (d: Date, months: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + months);
    return x;
  };
  for (const scope of scopes) {
    if (scope.id === "accu" && !(bike.isElectric || bike.batteryVoltage)) continue;
    if (scope.id === "elektrisch" && !bike.isElectric) continue;
    const months = scope.id === "accu" && bike.batteryWarrantyMonths ? bike.batteryWarrantyMonths : scope.months;
    if (!months) continue;
    records.push({
      scope: scope.id,
      description: scope.wording,
      startAt: saleDate,
      endAt: addMonths(saleDate, months),
    });
  }
  return records;
}

export async function markOrderUnpaid(
  orderId: string,
  status: "FAILED" | "EXPIRED" | "CANCELLED",
  reason: string | null = null,
): Promise<boolean> {
  let changed = false;
  await prisma.$transaction(async (tx) => {
    const order = (await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    })) as OrderWithRelations | null;
    if (!order) return;
    if (order.paymentStatus !== "PENDING") return; // idempotent / out-of-order events
    changed = true;
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: status,
        cancelledAt: new Date(),
        cancelReason: reason,
        internalNotes: reason ? appendNote(order.internalNotes, `Betaling ${status}: ${reason}`) : order.internalNotes,
      },
    });
    await releaseOrderResourcesTx(tx, order);
  });
  return changed;
}

export async function cancelOrder(
  orderId: string,
  reason: string | null,
  actorId: string | null = null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = (await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    })) as OrderWithRelations | null;
    if (!order) throw new OrderStateError("Bestelling niet gevonden");
    if (order.paymentStatus === "PAID") {
      throw new OrderStateError("Een betaalde bestelling kan niet worden geannuleerd; gebruik een retour/verzoek.");
    }
    if (order.paymentStatus === "CANCELLED") return; // idempotent
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "CANCELLED",
        fulfilmentStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
        internalNotes: appendNote(order.internalNotes, `Geannuleerd door ${actorId ?? "stelsel"}`),
      },
    });
    await releaseOrderResourcesTx(tx, order);
  });
}

export async function setFulfilmentStatus(
  orderId: string,
  status: "UNFULFILLED" | "PREPARING" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "FULFILLED" | "CANCELLED",
  actorId: string | null = null,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderStateError("Bestelling niet gevonden");
  if (order.paymentStatus === "CANCELLED") {
    throw new OrderStateError("Geannuleerde bestelling heeft geen vervulling.");
  }
  await prisma.order.update({
    where: { id: order.id },
    data: {
      fulfilmentStatus: status,
      fulfilledAt: status === "FULFILLED" ? new Date() : null,
      internalNotes: appendNote(order.internalNotes, `Vervulling: ${status} (${actorId ?? "stelsel"})`),
    },
  });
}

export interface RefundResult {
  status: "REFUNDED" | "PARTIALLY_REFUNDED";
  providerRefunded: boolean;
}

export async function refundOrder(
  orderId: string,
  amountCents: number | null, // null = full refund
  reason: string | null,
  actorId: string | null = null,
): Promise<RefundResult> {
  const provider = getPaymentProvider();
  let result: RefundResult = { status: "REFUNDED", providerRefunded: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new OrderStateError("Bestelling niet gevonden");
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
    throw new OrderStateError("Alleen betaalde bestellingen kunnen worden teruggestort.");
  }
  const fullRefund = amountCents == null || amountCents >= order.totalCents;
  result.status = fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

  // Provider refund first (best effort; record errors)
  const payment = order.payments[0];
  if (payment?.providerPaymentId) {
    try {
      await provider.refund(payment.providerPaymentId, fullRefund ? null : amountCents ?? order.totalCents);
      result.providerRefunded = true;
    } catch (err) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          internalNotes: appendNote(order.internalNotes, `Provider refund mislukt: ${err instanceof Error ? err.message : String(err)}`),
        },
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    const o = (await tx.order.findUnique({ where: { id: order.id }, include: { lines: true } })) as OrderWithRelations | null;
    if (!o) return;
    await tx.order.update({
      where: { id: o.id },
      data: {
        paymentStatus: result.status,
        cancelledAt: result.status === "REFUNDED" ? new Date() : o.cancelledAt,
        cancelReason: result.status === "REFUNDED" ? reason ?? o.cancelReason : o.cancelReason,
        internalNotes: appendNote(o.internalNotes, `Terugbetaling: ${result.status} (${reason ?? "geen reden"}) door ${actorId ?? "stelsel"}`),
      },
    });
    if (result.status === "REFUNDED") {
      await releaseOrderResourcesTx(tx, o);
      // Refunded unique bikes come back into stock (they physically return)
      for (const line of o.lines) {
        if (line.kind === "UNIQUE_BIKE" && line.bikeId) {
          await tx.bike.updateMany({
            where: { id: line.bikeId, status: "SOLD" },
            data: { status: "AVAILABLE", soldAt: null, soldOrderNumber: null, realisedSalePriceCents: null },
          });
        }
      }
    }
  });

  return result;
}

function appendNote(existing: string | null, note: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `[${stamp}] ${note}`;
  return existing ? `${existing}\n${line}` : line;
}

// --- Background sweep ---------------------------------------------------------

/**
 * Release expired reservations and expire stale pending orders.
 * Run periodically (instrumentation) and lazily on reads.
 */
export async function sweepExpiredOrders(): Promise<{ expiredOrders: number; releasedReservations: number }> {
  let expiredOrders = 0;
  let releasedReservations = 0;
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ttlMs());

    // 1) Reservations without order (e.g. manual/appointment holds that
    //    simply lapsed) -> release the bike if still reserved.
    const loose = await tx.reservation.findMany({
      where: { status: "ACTIVE", orderId: null, expiresAt: { lt: now } },
    });
    for (const r of loose) {
      const claimed = await tx.reservation.updateMany({
        where: { id: r.id, status: "ACTIVE", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
      if (claimed.count !== 1) continue;
      const res = await tx.bike.updateMany({
        where: { id: r.bikeId, status: "RESERVED" },
        data: { status: "AVAILABLE" },
      });
      releasedReservations += res.count;
    }

    // 2) Pending orders past TTL -> expire, release, restock.
    const stale = await tx.order.findMany({
      where: { paymentStatus: "PENDING", placedAt: { lt: cutoff } },
      include: { lines: true },
    });
    for (const order of stale) {
      const o = order as unknown as OrderWithRelations;
      // Claim the PENDING order in the UPDATE itself. Two overlapping cron
      // runs must not both restore the same stock.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: "PENDING" },
        data: {
          paymentStatus: "EXPIRED",
          cancelledAt: now,
          cancelReason: "Betaling niet tijdig voltooid",
          internalNotes: appendNote(o.internalNotes, "Automatisch verlopen (betaling niet voltooid)"),
        },
      });
      if (claimed.count !== 1) continue;
      await releaseOrderResourcesTx(tx, o);
      expiredOrders++;
    }
  });
  return { expiredOrders, releasedReservations };
}

let lazySweep: Promise<{ expiredOrders: number; releasedReservations: number }> | null = null;
let lastLazySweepAt = 0;

/**
 * Run a bounded best-effort sweep on customer-facing availability reads. This
 * protects stock even if a platform cron is delayed; the protected cron route
 * remains the primary scheduler in production.
 */
export async function sweepExpiredOrdersIfDue(intervalMs = 60_000): Promise<void> {
  const now = Date.now();
  if (lazySweep) {
    await lazySweep;
    return;
  }
  if (now - lastLazySweepAt < intervalMs) return;

  lazySweep = sweepExpiredOrders()
    .catch((err) => {
      // Browsing the catalogue must stay available if a maintenance query has
      // a temporary database problem. Checkout still performs a strict sweep.
      console.error("lazy order sweep failed", err);
      return { expiredOrders: 0, releasedReservations: 0 };
    })
    .finally(() => {
      // Also throttle a failing database so concurrent catalogue requests do
      // not turn one temporary outage into a request storm.
      lastLazySweepAt = Date.now();
    });
  try {
    await lazySweep;
  } finally {
    lazySweep = null;
  }
}



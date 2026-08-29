import type { Bike, Order, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { env } from "./env";
import { addMonths, getWarrantyScopes } from "./warranty";
import { getPaymentProvider } from "./payments";
import { ensureInvoicePdf, createIssuedInvoiceInTx, getInvoiceCompanySnapshot, type OrderForInvoice } from "./invoices";
import { uniqueBikeLinesForOrder, OrderLifecycleIntegrityError } from "./order-lifecycle";
import { roleAtLeast, type SessionUser } from "./auth";

/**
 * Order lifecycle.
 *
 * A physical bike becomes SOLD in exactly one place: finishClaimedSaleTx().
 * The function is reached only after a verified online payment or an explicit
 * staff confirmation for CASH/BANK_TRANSFER. It commits order, payment,
 * reservations, bike, warranty, invoice and audit records in one database
 * transaction, so no partial manual sale can bypass the dossier.
 */

export class OrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStateError";
  }
}

class SaleResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleResourceConflictError";
  }
}

function ttlMs(): number {
  return env.reservationTtlMinutes * 60_000;
}

export type OrderWithRelations = Order & {
  lines: {
    id: string;
    kind: "UNIQUE_BIKE" | "STOCK_ITEM";
    bikeId: string | null;
    productId: string | null;
    name: string;
    identifier: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    taxRate: number;
    taxCents: number;
  }[];
};

type SaleBike = Pick<Bike, "id" | "status" | "isElectric" | "batteryVoltage" | "batteryWarrantyMonths">;
type SaleReservation = { id: string; bikeId: string; expiresAt: Date };

interface SaleResources {
  bikeLines: ReturnType<typeof uniqueBikeLinesForOrder<OrderWithRelations["lines"][number]>>;
  bikesById: Map<string, SaleBike>;
  reservationsByBikeId: Map<string, SaleReservation>;
}

export interface SaleCompletionResult {
  outcome: "completed" | "already_completed" | "manual_review";
  invoiceId: string | null;
  invoiceNumber: string | null;
}

function asInvoiceOrder(order: OrderWithRelations, paidAt: Date): OrderForInvoice {
  return { ...order, paymentStatus: "PAID", paidAt } as OrderForInvoice;
}

async function auditTx(
  tx: Prisma.TransactionClient,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> | null,
  actor: SessionUser | null,
) {
  await tx.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
      actorId: actor?.id ?? null,
      actorType: actor ? "USER" : "SYSTEM",
    },
  });
}

/** Return a reason instead of mutating when a sale can no longer be safe. */
async function saleResourcesForOrderTx(
  tx: Prisma.TransactionClient,
  order: OrderWithRelations,
  saleAt: Date,
): Promise<{ resources: SaleResources | null; reason: string | null }> {
  let bikeLines: SaleResources["bikeLines"];
  try {
    bikeLines = uniqueBikeLinesForOrder(order.lines);
  } catch (error) {
    return {
      resources: null,
      reason: error instanceof OrderLifecycleIntegrityError ? error.message : "Ongeldige fietsregels in bestelling.",
    };
  }

  if (bikeLines.length === 0) {
    return { resources: { bikeLines, bikesById: new Map(), reservationsByBikeId: new Map() }, reason: null };
  }

  const bikeIds = bikeLines.map((line) => line.bikeId!);
  // Keep transaction queries ordered on one connection. The final guarded
  // updates below remain the race authority; this avoids avoidable driver
  // interleaving in interactive transactions.
  const bikes = await tx.bike.findMany({
    where: { id: { in: bikeIds } },
    select: {
      id: true,
      status: true,
      isElectric: true,
      batteryVoltage: true,
      batteryWarrantyMonths: true,
    },
  });
  const reservations = await tx.reservation.findMany({
    where: {
      orderId: order.id,
      bikeId: { in: bikeIds },
      status: "ACTIVE",
    },
    select: { id: true, bikeId: true, expiresAt: true },
  });
  const bikesById = new Map(bikes.map((bike) => [bike.id, bike]));
  const reservationsByBikeId = new Map<string, SaleReservation>();

  for (const reservation of reservations) {
    if (reservationsByBikeId.has(reservation.bikeId)) {
      return { resources: null, reason: "Meerdere actieve reserveringen voor één fiets in deze bestelling." };
    }
    reservationsByBikeId.set(reservation.bikeId, reservation);
  }

  for (const line of bikeLines) {
    const bike = bikesById.get(line.bikeId!);
    const reservation = reservationsByBikeId.get(line.bikeId!);
    if (!bike || bike.status !== "RESERVED") {
      return { resources: null, reason: `Fietsregel ${line.bikeId} heeft geen geldige gereserveerde fiets.` };
    }
    if (!reservation || reservation.expiresAt < saleAt) {
      return { resources: null, reason: `Fietsregel ${line.bikeId} heeft geen geldige actieve orderreservering.` };
    }
  }

  return { resources: { bikeLines, bikesById, reservationsByBikeId }, reason: null };
}

async function markPaymentForManualReviewTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
  order: OrderWithRelations,
  reason: string,
  paidAt: Date,
  actor: SessionUser | null,
): Promise<SaleCompletionResult> {
  // The order object may have been read just before another worker completed
  // it. Re-read under the current transaction before ever downgrading a paid
  // payment to manual review.
  const currentOrder = await tx.order.findUnique({
    where: { id: order.id },
    select: { id: true, paymentStatus: true },
  });
  if (currentOrder?.paymentStatus === "PAID") {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "paid", capturedAt: paidAt },
    });
    const invoice = await tx.invoice.findUnique({ where: { issuedOrderKey: order.id } });
    return {
      outcome: "already_completed",
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
    };
  }
  await tx.payment.update({
    where: { id: paymentId },
    data: { status: "paid_requires_manual_review", capturedAt: paidAt },
  });
  await auditTx(
    tx,
    "sale.completion_requires_review",
    "Order",
    order.id,
    { orderNumber: order.orderNumber, paymentId, reason },
    actor,
  );
  return { outcome: "manual_review", invoiceId: null, invoiceNumber: null };
}

/**
 * Release every resource associated with an uncompleted order. Bikes are
 * released from the order lines, not only from reservation rows; this also
 * repairs historic rows created by the former single-bike reservation bug.
 */
async function releaseOrderResourcesTx(tx: Prisma.TransactionClient, order: OrderWithRelations): Promise<number> {
  await tx.reservation.updateMany({
    where: { orderId: order.id, status: "ACTIVE" },
    data: { status: "RELEASED" },
  });

  let releasedBikes = 0;
  let bikeLines: ReturnType<typeof uniqueBikeLinesForOrder<OrderWithRelations["lines"][number]>> = [];
  try {
    bikeLines = uniqueBikeLinesForOrder(order.lines);
  } catch {
    // Corrupt historic lines must never stop product restock. Find their bike
    // ids defensively, without allowing duplicate releases to matter.
    bikeLines = [
      ...new Map(
        order.lines
          .filter((line) => line.kind === "UNIQUE_BIKE" && line.bikeId)
          .map((line) => [line.bikeId!, line]),
      ).values(),
    ] as typeof bikeLines;
  }

  for (const line of bikeLines) {
    const released = await tx.bike.updateMany({
      where: {
        id: line.bikeId!,
        status: "RESERVED",
        // Never undo another current hold that won a race after this order.
        reservations: { none: { status: "ACTIVE" } },
      },
      data: { status: "AVAILABLE" },
    });
    releasedBikes += released.count;
  }

  for (const line of order.lines) {
    if (line.kind !== "STOCK_ITEM" || !line.productId) continue;
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
  return releasedBikes;
}

/** Freeze warranty terms for the exact bike at the sale instant. */
export async function buildWarrantyRecords(
  bike: Pick<Bike, "id" | "isElectric" | "batteryVoltage" | "batteryWarrantyMonths">,
  saleDate: Date,
  scopes?: Awaited<ReturnType<typeof getWarrantyScopes>>,
) {
  const applicableScopes = scopes ?? await getWarrantyScopes();
  const records: { bikeId: string; scope: string; description: string; startAt: Date; endAt: Date }[] = [];
  for (const scope of applicableScopes) {
    if (scope.id === "accu" && !(bike.isElectric || bike.batteryVoltage)) continue;
    if (scope.id === "elektrisch" && !bike.isElectric) continue;
    const months = scope.id === "accu" && bike.batteryWarrantyMonths ? bike.batteryWarrantyMonths : scope.months;
    if (!months) continue;
    const duration = `${months} ${months === 1 ? "maand" : "maanden"}`;
    const description = months === scope.months
      ? scope.wording
      : scope.wording.replace(/\d+\s+maanden?/i, duration);
    records.push({
      bikeId: bike.id,
      scope: scope.id,
      description: description === scope.wording && months !== scope.months ? `${scope.wording} (duur: ${duration})` : description,
      startAt: saleDate,
      endAt: addMonths(saleDate, months),
    });
  }
  return records;
}

async function finishClaimedSaleTx(
  tx: Prisma.TransactionClient,
  order: OrderWithRelations,
  payment: { id: string; amountCents: number; currency: string; method: PaymentMethod },
  resources: SaleResources,
  saleAt: Date,
  warrantyScopes: Awaited<ReturnType<typeof getWarrantyScopes>>,
  company: Awaited<ReturnType<typeof getInvoiceCompanySnapshot>>,
  actor: SessionUser | null,
): Promise<SaleCompletionResult> {
  const paymentUpdated = await tx.payment.updateMany({
    where: { id: payment.id, amountCents: order.totalCents, currency: order.currency },
    data: { status: "paid", capturedAt: saleAt },
  });
  if (paymentUpdated.count !== 1) {
    throw new SaleResourceConflictError("Betalingsbedrag veranderde tijdens verkoopafronding.");
  }

  for (const line of resources.bikeLines) {
    const bike = resources.bikesById.get(line.bikeId!);
    const reservation = resources.reservationsByBikeId.get(line.bikeId!);
    if (!bike || !reservation) throw new SaleResourceConflictError("Fietsreservering verdween tijdens verkoopafronding.");

    const warranties = await buildWarrantyRecords(bike, saleAt, warrantyScopes);
    const lastWarranty = warranties[warranties.length - 1];
    const sold = await tx.bike.updateMany({
      where: {
        id: bike.id,
        status: "RESERVED",
        reservations: { some: { id: reservation.id, orderId: order.id, status: "ACTIVE" } },
      },
      data: {
        status: "SOLD",
        soldAt: saleAt,
        soldOrderNumber: order.orderNumber,
        warrantyStart: saleAt,
        warrantyEnd: lastWarranty?.endAt ?? null,
        realisedSalePriceCents: line.unitPriceCents,
      },
    });
    if (sold.count !== 1) {
      throw new SaleResourceConflictError("Fietsstatus of reservering veranderde tijdens verkoopafronding.");
    }
    const converted = await tx.reservation.updateMany({
      where: { id: reservation.id, orderId: order.id, status: "ACTIVE" },
      data: { status: "CONVERTED_TO_ORDER" },
    });
    if (converted.count !== 1) {
      throw new SaleResourceConflictError("Fietsreservering kon niet aan de bestelling worden gekoppeld.");
    }
    if (warranties.length) {
      await tx.warrantyRecord.createMany({
        data: warranties.map((warranty) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...warranty,
        })),
      });
    }
    await auditTx(
      tx,
      "bike.sold_via_sale_completion",
      "Bike",
      bike.id,
      { orderNumber: order.orderNumber, paymentId: payment.id, realisedSalePriceCents: line.unitPriceCents },
      actor,
    );
  }

  const invoice = await createIssuedInvoiceInTx(tx, asInvoiceOrder(order, saleAt), company);
  await auditTx(
    tx,
    "sale.completed",
    "Order",
    order.id,
    {
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      paymentMethod: payment.method,
      totalCents: order.totalCents,
      invoiceNumber: invoice.invoiceNumber,
      bikeCount: resources.bikeLines.length,
    },
    actor,
  );
  await auditTx(
    tx,
    "invoice.issued_via_sale_completion",
    "Invoice",
    invoice.id,
    { invoiceNumber: invoice.invoiceNumber, orderNumber: order.orderNumber },
    actor,
  );

  return { outcome: "completed", invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}

async function completeVerifiedPaymentSaleTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
  paidAt: Date,
  warrantyScopes: Awaited<ReturnType<typeof getWarrantyScopes>>,
  company: Awaited<ReturnType<typeof getInvoiceCompanySnapshot>>,
): Promise<SaleCompletionResult> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { lines: true } } },
  });
  if (!payment) throw new OrderStateError("Betaling niet gevonden.");
  const order = payment.order as OrderWithRelations;

  if (payment.amountCents !== order.totalCents || payment.currency !== order.currency) {
    return markPaymentForManualReviewTx(
      tx,
      payment.id,
      order,
      "Geverifieerd bedrag of valuta wijkt af van de bestelling.",
      paidAt,
      null,
    );
  }

  if (order.paymentStatus === "PAID") {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "paid", capturedAt: payment.capturedAt ?? paidAt } });
    const invoice = await tx.invoice.findUnique({ where: { issuedOrderKey: order.id } });
    return { outcome: "already_completed", invoiceId: invoice?.id ?? null, invoiceNumber: invoice?.invoiceNumber ?? null };
  }
  if (order.paymentStatus !== "PENDING") {
    return markPaymentForManualReviewTx(
      tx,
      payment.id,
      order,
      `Bestelling heeft terminale status ${order.paymentStatus}.`,
      paidAt,
      null,
    );
  }

  const eligibility = await saleResourcesForOrderTx(tx, order, paidAt);
  if (!eligibility.resources) {
    return markPaymentForManualReviewTx(tx, payment.id, order, eligibility.reason ?? "Verkoop kan niet veilig worden afgerond.", paidAt, null);
  }

  // Claiming PENDING in the update itself guarantees that only one webhook or
  // manual payment path can enter finishClaimedSaleTx.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING" },
    data: { paymentStatus: "PAID", paidAt },
  });
  if (claimed.count !== 1) {
    throw new SaleResourceConflictError("Bestelling is gelijktijdig verwerkt.");
  }
  return finishClaimedSaleTx(tx, order, payment, eligibility.resources, paidAt, warrantyScopes, company, null);
}

/**
 * The only online-provider entry point into the sale-completion flow. Call it
 * only after the provider adapter has independently verified the payment.
 */
export async function completeVerifiedPaymentSale(paymentId: string, paidAt: Date | null = null): Promise<SaleCompletionResult> {
  const saleAt = paidAt ?? new Date();
  const [warrantyScopes, company] = await Promise.all([getWarrantyScopes(), getInvoiceCompanySnapshot()]);
  let result: SaleCompletionResult;
  try {
    result = await prisma.$transaction((tx) => completeVerifiedPaymentSaleTx(tx, paymentId, saleAt, warrantyScopes, company));
  } catch (error) {
    if (!(error instanceof SaleResourceConflictError)) throw error;
    // A late/competing payment must not turn a bike SOLD. Preserve the paid
    // signal on the payment for staff reconciliation and leave stock untouched.
    result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { lines: true } } } });
      if (!payment) throw error;
      if (payment.order.paymentStatus === "PAID") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "paid", capturedAt: payment.capturedAt ?? saleAt },
        });
        const invoice = await tx.invoice.findUnique({ where: { issuedOrderKey: payment.order.id } });
        return {
          outcome: "already_completed",
          invoiceId: invoice?.id ?? null,
          invoiceNumber: invoice?.invoiceNumber ?? null,
        } as SaleCompletionResult;
      }
      return markPaymentForManualReviewTx(
        tx,
        payment.id,
        payment.order as OrderWithRelations,
        error.message,
        saleAt,
        null,
      );
    });
  }
  if (result.invoiceId) await ensureInvoicePdf(result.invoiceId);
  return result;
}

/**
 * Future POS/bank-reconciliation entry point. No route/UI invokes this in P0.
 * A staff member has to explicitly attest receipt; amount and currency always
 * come from the persisted order, never from a cashier/client payload.
 */
export async function confirmManualPayment(
  orderId: string,
  method: Extract<PaymentMethod, "CASH" | "BANK_TRANSFER">,
  actor: SessionUser | null,
): Promise<SaleCompletionResult> {
  if (!actor || !roleAtLeast(actor.role, "STAFF")) {
    throw new OrderStateError("Alleen bevoegd personeel kan een handmatige betaling bevestigen.");
  }
  if (method !== "CASH" && method !== "BANK_TRANSFER") {
    throw new OrderStateError("Deze handmatige betalingsmethode is niet toegestaan.");
  }

  const saleAt = new Date();
  const [warrantyScopes, company] = await Promise.all([getWarrantyScopes(), getInvoiceCompanySnapshot()]);
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: true, payments: true } });
    if (!order) throw new OrderStateError("Bestelling niet gevonden.");
    const withRelations = order as OrderWithRelations;
    if (order.paymentStatus === "PAID") {
      const invoice = await tx.invoice.findUnique({ where: { issuedOrderKey: order.id } });
      return { outcome: "already_completed", invoiceId: invoice?.id ?? null, invoiceNumber: invoice?.invoiceNumber ?? null } as SaleCompletionResult;
    }
    if (order.paymentStatus !== "PENDING") {
      throw new OrderStateError(`Bestelling ${order.orderNumber} kan niet handmatig betaald worden (status ${order.paymentStatus}).`);
    }
    if (order.payments.some((payment) => ["creating", "open", "pending"].includes(payment.status) && payment.method !== "CASH" && payment.method !== "BANK_TRANSFER")) {
      throw new OrderStateError("Deze bestelling heeft nog een actieve online betaling. Rond die eerst af of annuleer hem veilig.");
    }

    const eligibility = await saleResourcesForOrderTx(tx, withRelations, saleAt);
    if (!eligibility.resources) throw new OrderStateError(eligibility.reason ?? "Verkoop kan niet veilig worden afgerond.");
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID", paidAt: saleAt },
    });
    if (claimed.count !== 1) throw new SaleResourceConflictError("Bestelling is gelijktijdig verwerkt.");

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: "manual",
        method,
        amountCents: order.totalCents,
        currency: order.currency,
        status: "received",
        capturedAt: saleAt,
        description: `${method === "CASH" ? "Contante betaling" : "Bankoverschrijving"} bevestigd door ${actor.email}`,
        metadata: { confirmedBy: actor.id, confirmedByEmail: actor.email },
      },
    });
    await auditTx(
      tx,
      "payment.manually_confirmed",
      "Payment",
      payment.id,
      { orderNumber: order.orderNumber, method, amountCents: order.totalCents },
      actor,
    );
    return finishClaimedSaleTx(tx, withRelations, payment, eligibility.resources, saleAt, warrantyScopes, company, actor);
  });
  if (result.invoiceId) await ensureInvoicePdf(result.invoiceId);
  return result;
}

/** Record an explicit failed/cancelled/expired provider result and release once. */
export async function recordPaymentFailure(
  paymentId: string,
  status: "FAILED" | "EXPIRED" | "CANCELLED",
  providerStatus: string,
  reason: string | null = null,
): Promise<boolean> {
  let changed = false;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { lines: true } } } });
    if (!payment) return;
    const order = payment.order as OrderWithRelations;
    if (order.paymentStatus !== "PENDING") return;
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: {
        paymentStatus: status,
        cancelledAt: new Date(),
        cancelReason: reason,
        internalNotes: reason ? appendNote(order.internalNotes, `Betaling ${status}: ${reason}`) : order.internalNotes,
      },
    });
    if (claimed.count !== 1) return;
    await tx.payment.update({ where: { id: payment.id }, data: { status: providerStatus } });
    const releasedBikes = await releaseOrderResourcesTx(tx, order);
    await auditTx(
      tx,
      "payment.failed_or_cancelled",
      "Order",
      order.id,
      { orderNumber: order.orderNumber, paymentId, status, providerStatus, reason, releasedBikes },
      null,
    );
    changed = true;
  });
  return changed;
}

/** Compatibility helper for a failure before a provider id exists. */
export async function markOrderUnpaid(
  orderId: string,
  status: "FAILED" | "EXPIRED" | "CANCELLED",
  reason: string | null = null,
): Promise<boolean> {
  let changed = false;
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order || order.paymentStatus !== "PENDING") return;
    const withRelations = order as OrderWithRelations;
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: {
        paymentStatus: status,
        cancelledAt: new Date(),
        cancelReason: reason,
        internalNotes: reason ? appendNote(order.internalNotes, `Betaling ${status}: ${reason}`) : order.internalNotes,
      },
    });
    if (claimed.count !== 1) return;
    const releasedBikes = await releaseOrderResourcesTx(tx, withRelations);
    await auditTx(tx, "order.payment_closed", "Order", order.id, { status, reason, releasedBikes }, null);
    changed = true;
  });
  return changed;
}

export async function cancelOrder(orderId: string, reason: string | null, actorId: string | null = null): Promise<boolean> {
  let cancelled = false;
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order) throw new OrderStateError("Bestelling niet gevonden.");
    if (order.paymentStatus === "PAID") {
      throw new OrderStateError("Een betaalde bestelling kan niet worden geannuleerd; gebruik een retour/verzoek.");
    }
    if (order.paymentStatus !== "PENDING") return; // already released/terminal: never restock twice
    const withRelations = order as OrderWithRelations;
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: {
        paymentStatus: "CANCELLED",
        fulfilmentStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
        internalNotes: appendNote(order.internalNotes, `Geannuleerd door ${actorId ?? "stelsel"}`),
      },
    });
    if (claimed.count !== 1) return;
    const releasedBikes = await releaseOrderResourcesTx(tx, withRelations);
    await auditTx(tx, "order.cancelled", "Order", order.id, { reason, releasedBikes }, null);
    cancelled = true;
  });
  return cancelled;
}

export async function setFulfilmentStatus(
  orderId: string,
  status: "UNFULFILLED" | "PREPARING" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "FULFILLED" | "CANCELLED",
  actor: SessionUser | null = null,
) {
  if (status === "CANCELLED") {
    throw new OrderStateError("Annuleren verloopt via de order-/betalingslifecycle, niet via fulfilmentstatus.");
  }
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderStateError("Bestelling niet gevonden.");
    if (order.paymentStatus !== "PAID") {
      throw new OrderStateError("Alleen een betaalde bestelling kan een fulfilmentstatus krijgen.");
    }
    const updated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PAID" },
      data: {
        fulfilmentStatus: status,
        fulfilledAt: status === "FULFILLED" ? new Date() : null,
        internalNotes: appendNote(order.internalNotes, `Vervulling: ${status} (${actor?.id ?? "stelsel"})`),
      },
    });
    if (updated.count !== 1) throw new OrderStateError("Betalingsstatus wijzigde gelijktijdig.");
    await auditTx(tx, "order.fulfilment_changed", "Order", order.id, { status }, actor);
  });
}

export interface RefundResult {
  status: "REFUNDED" | "PARTIALLY_REFUNDED";
  providerRefunded: boolean;
}

export async function refundOrder(
  orderId: string,
  amountCents: number | null,
  reason: string | null,
  actorId: string | null = null,
): Promise<RefundResult> {
  const provider = getPaymentProvider();
  let result: RefundResult = { status: "REFUNDED", providerRefunded: false };
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new OrderStateError("Bestelling niet gevonden.");
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
    throw new OrderStateError("Alleen betaalde bestellingen kunnen worden teruggestort.");
  }
  const fullRefund = amountCents == null || amountCents >= order.totalCents;
  result.status = fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const payment = order.payments[0];
  if (payment?.providerPaymentId) {
    try {
      await provider.refund(payment.providerPaymentId, fullRefund ? null : amountCents ?? order.totalCents);
      result.providerRefunded = true;
    } catch (error) {
      await prisma.order.update({
        where: { id: order.id },
        data: { internalNotes: appendNote(order.internalNotes, `Provider refund mislukt: ${error instanceof Error ? error.message : String(error)}`) },
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id }, include: { lines: true } });
    if (!current) return;
    const claimed = await tx.order.updateMany({
      where: { id: current.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      data: {
        paymentStatus: result.status,
        cancelledAt: result.status === "REFUNDED" ? new Date() : current.cancelledAt,
        cancelReason: result.status === "REFUNDED" ? reason ?? current.cancelReason : current.cancelReason,
        internalNotes: appendNote(current.internalNotes, `Terugbetaling: ${result.status} (${reason ?? "geen reden"}) door ${actorId ?? "stelsel"}`),
      },
    });
    if (claimed.count !== 1) return;
    if (result.status === "REFUNDED") {
      await releaseOrderResourcesTx(tx, current as OrderWithRelations);
      for (const line of current.lines) {
        if (line.kind !== "UNIQUE_BIKE" || !line.bikeId) continue;
        await tx.bike.updateMany({
          where: { id: line.bikeId, status: "SOLD", soldOrderNumber: current.orderNumber },
          data: {
            status: "AVAILABLE",
            soldAt: null,
            soldOrderNumber: null,
            warrantyStart: null,
            warrantyEnd: null,
            realisedSalePriceCents: null,
          },
        });
      }
    }
    await auditTx(tx, "order.refunded", "Order", current.id, { status: result.status, reason, amountCents }, null);
  });
  return result;
}

/** Repairs warranty rows issued before a bike link existed. */
export async function repairLegacyWarrantyRecords(): Promise<number> {
  const legacy = await prisma.warrantyRecord.findMany({ where: { bikeId: null }, select: { orderId: true } });
  const orderIds = [...new Set(legacy.map((item) => item.orderId))];
  const scopes = await getWarrantyScopes();
  for (const orderId of orderIds) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order || order.paymentStatus !== "PAID") continue;
    const saleDate = order.paidAt ?? order.placedAt;
    const records: Awaited<ReturnType<typeof buildWarrantyRecords>> = [];
    for (const line of order.lines) {
      if (line.kind !== "UNIQUE_BIKE" || !line.bikeId) continue;
      const bike = await prisma.bike.findUnique({
        where: { id: line.bikeId },
        select: { id: true, isElectric: true, batteryVoltage: true, batteryWarrantyMonths: true },
      });
      if (bike) records.push(...await buildWarrantyRecords(bike, saleDate, scopes));
    }
    await prisma.$transaction(async (tx) => {
      await tx.warrantyRecord.deleteMany({ where: { orderId } });
      if (records.length) {
        await tx.warrantyRecord.createMany({
          data: records.map((record) => ({ orderId, orderNumber: order.orderNumber, ...record })),
        });
      }
    });
  }
  return orderIds.length;
}

function appendNote(existing: string | null, note: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  return existing ? `${existing}\n[${stamp}] ${note}` : `[${stamp}] ${note}`;
}

// --- Background sweep ------------------------------------------------------

export async function sweepExpiredOrders(): Promise<{ expiredOrders: number; releasedReservations: number }> {
  let expiredOrders = 0;
  let releasedReservations = 0;
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ttlMs());

    const loose = await tx.reservation.findMany({
      where: { status: "ACTIVE", orderId: null, expiresAt: { lt: now } },
      select: { id: true, bikeId: true },
    });
    for (const reservation of loose) {
      const claimed = await tx.reservation.updateMany({
        where: { id: reservation.id, status: "ACTIVE", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
      if (claimed.count !== 1) continue;
      const released = await tx.bike.updateMany({
        where: { id: reservation.bikeId, status: "RESERVED", reservations: { none: { status: "ACTIVE" } } },
        data: { status: "AVAILABLE" },
      });
      releasedReservations += released.count;
    }

    const stale = await tx.order.findMany({
      where: { paymentStatus: "PENDING", placedAt: { lt: cutoff } },
      include: { lines: true },
    });
    for (const order of stale) {
      const withRelations = order as OrderWithRelations;
      const claimed = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: "PENDING" },
        data: {
          paymentStatus: "EXPIRED",
          cancelledAt: now,
          cancelReason: "Betaling niet tijdig voltooid",
          internalNotes: appendNote(order.internalNotes, "Automatisch verlopen (betaling niet voltooid)"),
        },
      });
      if (claimed.count !== 1) continue;
      releasedReservations += await releaseOrderResourcesTx(tx, withRelations);
      await auditTx(tx, "order.expired", "Order", order.id, { orderNumber: order.orderNumber }, null);
      expiredOrders++;
    }
  });
  return { expiredOrders, releasedReservations };
}

let lazySweep: Promise<{ expiredOrders: number; releasedReservations: number }> | null = null;
let lastLazySweepAt = 0;

export async function sweepExpiredOrdersIfDue(intervalMs = 60_000): Promise<void> {
  const now = Date.now();
  if (lazySweep) {
    await lazySweep;
    return;
  }
  if (now - lastLazySweepAt < intervalMs) return;

  lazySweep = sweepExpiredOrders()
    .catch((error) => {
      console.error("lazy order sweep failed", error);
      return { expiredOrders: 0, releasedReservations: 0 };
    })
    .finally(() => {
      lastLazySweepAt = Date.now();
    });
  try {
    await lazySweep;
  } finally {
    lazySweep = null;
  }
}

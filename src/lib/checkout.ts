import { prisma } from "./prisma";
import { env } from "./env";
import { getCartByToken, quoteCart, clearCart } from "./cart";
import { DeliveryError, getDeliveryConfig, quoteDelivery } from "./delivery";
import { getTaxConfig, taxRateForLine, lineTax } from "./tax";
import { nextOrderNumberInTx } from "./numbers";
import { markOrderPaid, markOrderUnpaid, sweepExpiredOrders } from "./orders";
import { getPaymentProvider } from "./payments";
import { audit } from "./audit";
import { trackEvent } from "./analytics";
import { emailOrderConfirmation } from "./email";
import { sha256Hex } from "./utils";
import { createPaymentStatusToken } from "./order-access";

/**
 * Checkout engine (specs 13, 14, 15, 37 — and Invariants 2, 3, 5, 9).
 *
 * Flow:
 *  1. Quote the cart server-side (prices always from DB, never from client).
 *  2. Quote delivery server-side (costs from admin config).
 *  3. In ONE interactive transaction:
 *       - issue the order number (atomic counter)
 *       - create the Order + immutable OrderLine snapshots
 *       - for each bike line: guarded AVAILABLE -> RESERVED update;
 *         if the row was not in AVAILABLE state the update touches 0 rows
 *         and the WHOLE transaction rolls back (Invariant 3 — two customers
 *         can never both buy the same physical bike)
 *       - for each product line: re-check stock under the transaction and
 *         decrement atomically
 *       - record the checkout reservation (TTL)
 *  4. After commit: create the provider payment and store its reference.
 *     If the provider call fails, the order is cancelled and resources
 *     released (reservation expired, stock restored).
 *
 * Webhook pipeline (Invariant 9): payment state is only ever applied from
 * verified provider state (Mollie: re-fetched over the API; mock: ledger
 * check), deduplicated via the WebhookEvent ledger.
 */

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: "CART_EMPTY" | "CART_INVALID" | "DELIVERY" | "PROVIDER" = "CART_INVALID",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

export interface CheckoutDelivery {
  methodId: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
}

export interface CreateCheckoutResult {
  orderNumber: string;
  orderId: string;
  statusToken: string;
  totalCents: number;
  currency: string;
  paymentUrl: string | null;
  provider: "mollie" | "mock";
}

export interface CheckoutInput {
  cartToken: string;
  customer: CheckoutCustomer;
  billing: { line1: string | null; line2: string | null; city: string | null; postcode: string | null; country: string };
  delivery: CheckoutDelivery;
  userId: string | null;
  internalNotes?: string | null;
}

export async function createCheckout(input: CheckoutInput): Promise<CreateCheckoutResult> {
  // Validate production configuration before creating any order or reserving
  // stock. A configuration error must never leave a pending order behind.
  const provider = getPaymentProvider();

  // Keep availability truthful even when the scheduled sweep was delayed.
  await sweepExpiredOrders();

  const cart = await getCartByToken(input.cartToken);
  if (!cart) throw new CheckoutError("Je winkelwagen is leeg of is verlopen.", "CART_EMPTY");

  const quote = await quoteCart(cart.id);
  if (quote.lines.length === 0) throw new CheckoutError("Je winkelwagen is leeg.", "CART_EMPTY");
  if (!quote.allValid) {
    throw new CheckoutError(quote.issues[0] ?? "Er is iets niet in orde met je winkelwagen.", "CART_INVALID");
  }

  const deliveryConfig = await getDeliveryConfig();
  const cartKinds = new Set(quote.lines.map((l) => l.kind));
  let deliveryQuote;
  try {
    deliveryQuote = quoteDelivery(
      deliveryConfig,
      input.delivery.methodId,
      cartKinds,
      quote.subtotalCents,
      input.delivery.postcode,
    );
  } catch (err) {
    if (err instanceof DeliveryError) throw new CheckoutError(err.message, "DELIVERY");
    throw err;
  }
  if (
    deliveryQuote.requiresAddress &&
    (!input.delivery.line1?.trim() || !input.delivery.city?.trim() || !input.delivery.postcode?.trim())
  ) {
    throw new CheckoutError("Vul straat, postcode en plaats in voor deze leveringsmethode.", "DELIVERY");
  }

  const taxConfig = await getTaxConfig();

  // Immutable spec snapshots (Invariant 8: orders keep their data even if
  // the bike/product changes later).
  const [bikeIds, productIds] = [
    quote.lines.filter((l) => l.kind === "UNIQUE_BIKE").map((l) => l.refId),
    quote.lines.filter((l) => l.kind === "STOCK_ITEM").map((l) => l.refId),
  ];
  const [bikes, products] = await Promise.all([
    bikeIds.length
      ? prisma.bike.findMany({
          where: { id: { in: bikeIds } },
          select: {
            id: true,
            inventoryCode: true,
            brand: true,
            model: true,
            frameSizeCm: true,
            wheelSizeCm: true,
            gears: true,
            batteryWh: true,
            batteryAh: true,
            motorPosition: true,
            conditionGrade: true,
            colour: true,
          },
        })
      : Promise.resolve([]),
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sku: true, category: true, title: true },
        })
      : Promise.resolve([]),
  ]);
  const bikeSpecs = new Map(bikes.map((b) => [b.id, b]));
  const productSpecs = new Map(products.map((p) => [p.id, p]));

  // ---- Totals (all server-side) -------------------------------------------
  const lines = quote.lines.map((l) => {
    const rate = taxRateForLine(taxConfig, l.kind);
    const lt = lineTax(l.lineTotalCents, rate, taxConfig.basis);
    return {
      kind: l.kind,
      bikeId: l.kind === "UNIQUE_BIKE" ? l.refId : null,
      productId: l.kind === "STOCK_ITEM" ? l.refId : null,
      name: l.name,
      identifier: l.identifier,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents,
      taxRate: lt.rate,
      taxCents: lt.taxCents,
      imageKey: l.imageKey,
      specs: l.kind === "UNIQUE_BIKE" ? (bikeSpecs.get(l.refId) ?? null) : (productSpecs.get(l.refId) ?? null),
    };
  });

  const subtotalCents = quote.subtotalCents;
  const taxTotalCents = lines.reduce((s, l) => s + l.taxCents, 0);
  const totalCents = subtotalCents + deliveryQuote.costCents + (taxConfig.basis === "excl" ? taxTotalCents : 0);

  if (totalCents <= 0) throw new CheckoutError("Totaalbedrag ongeldig.", "CART_INVALID");

  // ---- Atomic order creation ---------------------------------------------
  const ttlMinutes = env.reservationTtlMinutes;
  const reservationExpiry = new Date(Date.now() + ttlMinutes * 60_000);

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumberInTx(tx);

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
        customerCompany: input.customer.company,
        billingLine1: input.billing.line1,
        billingLine2: input.billing.line2,
        billingCity: input.billing.city,
        billingPostcode: input.billing.postcode,
        billingCountry: input.billing.country || "NL",
        deliveryMethod: deliveryQuote.methodId,
        deliveryLine1: input.delivery.line1,
        deliveryLine2: input.delivery.line2,
        deliveryCity: input.delivery.city,
        deliveryPostcode: input.delivery.postcode,
        deliveryCountry: input.delivery.country || "NL",
        deliveryCostCents: deliveryQuote.costCents,
        subtotalCents,
        taxTotalCents,
        totalCents,
        currency: "EUR",
        taxBasis: {
          basis: taxConfig.basis,
          bikeRate: taxConfig.bikeRate,
          accessoryRate: taxConfig.accessoryRate,
          requiresReview: taxConfig.requiresReview,
        },
        internalNotes: input.internalNotes ?? undefined,
        lines: {
          create: lines.map((l) => ({
            kind: l.kind,
            bikeId: l.bikeId,
            productId: l.productId,
            name: l.name,
            identifier: l.identifier,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            lineTotalCents: l.lineTotalCents,
            taxRate: l.taxRate,
            taxCents: l.taxCents,
            specs: l.specs == null ? undefined : (l.specs as object),
            imageKey: l.imageKey,
          })),
        },
      },
    });

    // --- UNIQUE_BIKE: guarded AVAILABLE -> RESERVED (the race guard) -------
    for (const l of lines) {
      if (l.kind !== "UNIQUE_BIKE" || !l.bikeId) continue;
      const updated = await tx.bike.updateMany({
        where: { id: l.bikeId, status: "AVAILABLE" },
        data: { status: "RESERVED" },
      });
      if (updated.count !== 1) {
        // Another checkout (or admin) won this bike. Roll everything back.
        throw new CheckoutError(
          "Deze fiets is net niet meer beschikbaar. We hebben je niets in rekening gebracht.",
          "CART_INVALID",
        );
      }
    }

    // --- STOCK_ITEM: re-check stock and decrement ---------------------------
    for (const l of lines) {
      if (l.kind !== "STOCK_ITEM" || !l.productId) continue;
      // The stock condition lives in the UPDATE itself. A preceding read is
      // not a lock under normal PostgreSQL isolation and could oversell when
      // two customers check out at the same time.
      const decremented = await tx.product.updateMany({
        where: { id: l.productId, active: true, stockQuantity: { gte: l.quantity } },
        data: { stockQuantity: { decrement: l.quantity } },
      });
      if (decremented.count !== 1) {
        throw new CheckoutError(
          `Nog niet genoeg voorraad voor ${l.name}.`,
          "CART_INVALID",
        );
      }
      await tx.stockMovement.create({
        data: {
          productId: l.productId,
          change: -l.quantity,
          reason: "order",
          reference: orderNumber,
        },
      });
    }

    // --- Reservation record (checkout TTL) ----------------------------------
    const bikeLine = lines.find((l) => l.kind === "UNIQUE_BIKE" && l.bikeId);
    if (bikeLine && bikeLine.bikeId) {
      await tx.reservation.create({
        data: {
          bikeId: bikeLine.bikeId,
          source: "CHECKOUT",
          orderId: created.id,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          expiresAt: reservationExpiry,
          status: "ACTIVE",
        },
      });
    }

    return created;
  });

  // ---- Provider payment (after commit; failure -> release) ----------------
  const baseUrl = env.baseUrl;
  const statusToken = createPaymentStatusToken(order.orderNumber);
  const resultUrl = `${baseUrl}/betaaling/resultaat?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(statusToken)}`;
  let providerPaymentId: string | null = null;
  let paymentUrl: string | null = null;
  let providerStatus = "PENDING";

  try {
    const intent = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      description: `Demi Fietsen — bestelling ${order.orderNumber}`,
      amountCents: totalCents,
      currency: "EUR",
      webhookUrl: `${baseUrl}/api/webhooks/${provider.name}`,
      redirectUrl: resultUrl,
      cancelUrl: `${resultUrl}&status=geannuleerd`,
      metadata: { orderNumber: order.orderNumber },
    });
    providerPaymentId = intent.providerPaymentId;
    paymentUrl = intent.paymentUrl;
    providerStatus = intent.status;
  } catch (err) {
    // Payment could not be created: cancel order, release bike/stock.
    await markOrderUnpaid(order.id, "FAILED", err instanceof Error ? err.message : "Betaling kon niet worden aangemaakt");
    throw new CheckoutError("De betaling kon niet worden aangemaakt. Je bent niets verschuldigd.", "PROVIDER");
  }

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerPaymentId,
      amountCents: totalCents,
      currency: "EUR",
      status: providerStatus,
      description: `Bestelling ${order.orderNumber}`,
      paymentUrl,
      metadata: { orderNumber: order.orderNumber, basis: taxConfig.basis },
    },
  });

  // Clear the cart only after a payment session exists (the reservation
  // keeps the bike safe even if the customer abandons the payment page).
  await clearCart(cart.id);

  await trackEvent("checkout_started", "order", order.orderNumber, {
    lines: lines.length,
    totalCents,
  });

  // Confirmation email (best effort; the webhook sends the paid confirmation).
  await emailOrderConfirmation({
    orderNumber: order.orderNumber,
    email: input.customer.email,
    name: input.customer.name,
    totalCents,
    lines: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
    paid: false,
    paymentUrl,
    deliveryMethodLabel: deliveryQuote.label,
  }).catch((err) => console.error("emailOrderConfirmation failed", err));

  return {
    orderNumber: order.orderNumber,
    orderId: order.id,
    statusToken,
    totalCents,
    currency: "EUR",
    paymentUrl,
    provider: provider.name,
  };
}

// ---------------------------------------------------------------------------
// Webhook processing (idempotent, verified)
// ---------------------------------------------------------------------------

export interface WebhookResult {
  outcome: "processed" | "duplicate" | "ignored" | "error";
  detail?: string;
}

/**
 * Entry point for provider webhook endpoints.
 *
 * - provider.interpretWebhook() performs the identity verification
 *   (Mollie: re-fetch over API; mock: ledger check) and returns ONLY
 *   verified state.
 * - WebhookEvent ledger dedupes repeated deliveries.
 * - markOrderPaid / markOrderUnpaid are themselves idempotent.
 */
export async function processProviderWebhook(
  providerName: "mollie" | "mock",
  rawPayload: unknown,
): Promise<WebhookResult> {
  const provider = getPaymentProvider();
  if (provider.name !== providerName) {
    return { outcome: "error", detail: `Webhook provider ${providerName} is niet actief.` };
  }

  let verified: {
    providerPaymentId: string;
    state: "paid" | "canceled" | "expired" | "failed" | "open";
    paidAt?: Date | null;
    amountCents?: number;
    currency?: string;
  };
  try {
    verified = await provider.interpretWebhook(rawPayload);
  } catch (err) {
    return {
      outcome: "error",
      detail: err instanceof Error ? err.message : "interpretWebhook failed",
    };
  }

  // Open notifications do not cause an order state change. They are useful to
  // the provider but not durable business events, so do not fill the webhook
  // ledger with them.
  if (verified.state === "open") {
    return { outcome: "ignored", detail: "payment still open" };
  }

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: verified.providerPaymentId },
    include: { order: true },
  });
  if (!payment || payment.provider !== providerName) {
    return { outcome: "error", detail: "Onbekende betaling" };
  }
  if (
    (verified.amountCents != null && verified.amountCents !== payment.amountCents) ||
    (verified.currency != null && verified.currency !== payment.currency)
  ) {
    return { outcome: "error", detail: "Betalingsbedrag of valuta komt niet overeen" };
  }

  const externalEventId = `${verified.providerPaymentId}:${verified.state}`;

  // Dedupe BEFORE side effects; the unique constraint is the last line of
  // defence against duplicate processing.
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalEventId: { provider: providerName, externalEventId } },
  });
  if (existing) {
    return { outcome: "duplicate", detail: externalEventId };
  }

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: providerName,
        externalEventId,
        type: `payment.${verified.state}`,
        payloadHash: hashPayload(rawPayload),
        status: "RECEIVED",
      },
    });
  } catch {
    // P2002 unique violation -> concurrent duplicate.
    return { outcome: "duplicate", detail: externalEventId };
  }

  try {
    if (verified.state === "paid") {
      const changed = await markOrderPaid(payment.orderId, verified.paidAt ?? null);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "paid", capturedAt: verified.paidAt ?? new Date() },
      });
      if (changed) {
        await trackEvent("purchase", "order", payment.order.orderNumber, {
          totalCents: payment.order.totalCents,
        });
        await emailOrderConfirmation({
          orderNumber: payment.order.orderNumber,
          email: payment.order.customerEmail,
          name: payment.order.customerName,
          totalCents: payment.order.totalCents,
          lines: (
            await prisma.orderLine.findMany({
              where: { orderId: payment.orderId },
              select: { name: true, quantity: true },
            })
          ).map((l) => ({ name: l.name, quantity: l.quantity })),
          paid: true,
          paymentUrl: null,
          deliveryMethodLabel: null,
        }).catch((err) => console.error("paid email failed", err));
      }
    } else {
      const status = verified.state === "canceled" ? "CANCELLED" : verified.state === "expired" ? "EXPIRED" : "FAILED";
      await markOrderUnpaid(payment.orderId, status, `provider: ${verified.state}`);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: verified.state },
      });
    }

    await prisma.webhookEvent.update({
      where: { provider_externalEventId: { provider: providerName, externalEventId } },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    await audit(
      "payment.webhook",
      "Payment",
      payment.id,
      { state: verified.state, orderNumber: payment.order.orderNumber },
      null,
    );

    return { outcome: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markEventFailed(providerName, externalEventId, message);
    return { outcome: "error", detail: message };
  }
}

async function markEventFailed(provider: string, externalEventId: string, error: string) {
  try {
    await prisma.webhookEvent.update({
      where: { provider_externalEventId: { provider, externalEventId } },
      data: { status: "FAILED", error },
    });
  } catch {
    /* ignore */
  }
}

function hashPayload(payload: unknown): string {
  try {
    return sha256Hex(JSON.stringify(payload)).slice(0, 64);
  } catch {
    return "n/a";
  }
}

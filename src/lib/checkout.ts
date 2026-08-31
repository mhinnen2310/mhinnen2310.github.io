import { prisma } from "./prisma";
import { env } from "./env";
import { getCartByToken, quoteCart, clearCart } from "./cart";
import { DeliveryError, getDeliveryConfig, quoteDelivery } from "./delivery";
import { getTaxConfig, taxRateForLine, lineTax } from "./tax";
import { nextOrderNumberInTx } from "./numbers";
import { completeVerifiedPaymentSale, recordPaymentFailure, sweepExpiredOrders } from "./orders";
import { checkoutReservationRows, uniqueBikeLinesForOrder, OrderLifecycleIntegrityError } from "./order-lifecycle";
import { getPaymentProvider } from "./payments";
import { audit } from "./audit";
import { trackEvent } from "./analytics";
import { emailOrderConfirmation } from "./email";
import { emailInvoiceForOrder } from "./invoices";
import { sha256Hex } from "./utils";
import { createPaymentStatusToken } from "./order-access";

/**
 * Checkout engine.
 *
 * Prices and total are quoted server-side. In the checkout transaction every
 * physical bike obtains its own ACTIVE reservation row and every product is
 * decremented conditionally. The payment row is created before calling the
 * provider, so both success and failure have one durable lifecycle target.
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

interface CheckoutLine {
  kind: "UNIQUE_BIKE" | "STOCK_ITEM";
  bikeId: string | null;
  productId: string | null;
  name: string;
  identifier: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  taxRate: number;
  taxCents: number;
  imageKey: string | null;
  specs: object | null;
}

function paymentMethodFor(provider: "mollie" | "mock") {
  return provider === "mollie" ? "MOLLIE" as const : "MOCK" as const;
}

export async function createCheckout(input: CheckoutInput): Promise<CreateCheckoutResult> {
  const provider = getPaymentProvider();
  await sweepExpiredOrders();

  const cart = await getCartByToken(input.cartToken);
  if (!cart) throw new CheckoutError("Je winkelwagen is leeg of is verlopen.", "CART_EMPTY");
  const quote = await quoteCart(cart.id);
  if (quote.lines.length === 0) throw new CheckoutError("Je winkelwagen is leeg.", "CART_EMPTY");
  if (!quote.allValid) {
    throw new CheckoutError(quote.issues[0] ?? "Er is iets niet in orde met je winkelwagen.", "CART_INVALID");
  }

  const deliveryConfig = await getDeliveryConfig();
  const cartKinds = new Set(quote.lines.map((line) => line.kind));
  let deliveryQuote;
  try {
    deliveryQuote = quoteDelivery(
      deliveryConfig,
      input.delivery.methodId,
      cartKinds,
      quote.subtotalCents,
      input.delivery.postcode,
    );
  } catch (error) {
    if (error instanceof DeliveryError) throw new CheckoutError(error.message, "DELIVERY");
    throw error;
  }
  if (
    deliveryQuote.requiresAddress &&
    (!input.delivery.line1?.trim() || !input.delivery.city?.trim() || !input.delivery.postcode?.trim())
  ) {
    throw new CheckoutError("Vul straat, postcode en plaats in voor deze leveringsmethode.", "DELIVERY");
  }

  const taxConfig = await getTaxConfig();
  const bikeIds = quote.lines.filter((line) => line.kind === "UNIQUE_BIKE").map((line) => line.refId);
  const productIds = quote.lines.filter((line) => line.kind === "STOCK_ITEM").map((line) => line.refId);
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
            wheelSizeInches: true,
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
  const bikeSpecs = new Map(bikes.map((bike) => [bike.id, bike]));
  const productSpecs = new Map(products.map((product) => [product.id, product]));

  const lines: CheckoutLine[] = quote.lines.map((line) => {
    const rate = taxRateForLine(taxConfig, line.kind);
    const tax = lineTax(line.lineTotalCents, rate, taxConfig.basis);
    return {
      kind: line.kind,
      bikeId: line.kind === "UNIQUE_BIKE" ? line.refId : null,
      productId: line.kind === "STOCK_ITEM" ? line.refId : null,
      name: line.name,
      identifier: line.identifier,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
      taxRate: tax.rate,
      taxCents: tax.taxCents,
      imageKey: line.imageKey,
      specs: line.kind === "UNIQUE_BIKE" ? (bikeSpecs.get(line.refId) ?? null) : (productSpecs.get(line.refId) ?? null),
    };
  });

  let bikeLines: CheckoutLine[];
  try {
    bikeLines = uniqueBikeLinesForOrder(lines);
  } catch (error) {
    throw new CheckoutError(
      error instanceof OrderLifecycleIntegrityError ? error.message : "De fietsregels in je winkelwagen zijn ongeldig.",
      "CART_INVALID",
    );
  }
  const productLines = lines
    .filter((line) => line.kind === "STOCK_ITEM" && line.productId)
    .sort((a, b) => a.productId!.localeCompare(b.productId!));
  const subtotalCents = quote.subtotalCents;
  const taxTotalCents = lines.reduce((total, line) => total + line.taxCents, 0);
  const totalCents = subtotalCents + deliveryQuote.costCents + (taxConfig.basis === "excl" ? taxTotalCents : 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new CheckoutError("Totaalbedrag ongeldig.", "CART_INVALID");
  }

  const reservationExpiry = new Date(Date.now() + env.reservationTtlMinutes * 60_000);
  const checkout = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumberInTx(tx);
    const order = await tx.order.create({
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
          create: lines.map((line) => ({
            kind: line.kind,
            bikeId: line.bikeId,
            productId: line.productId,
            name: line.name,
            identifier: line.identifier,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
            taxRate: line.taxRate,
            taxCents: line.taxCents,
            specs: line.specs ?? undefined,
            imageKey: line.imageKey,
          })),
        },
      },
    });

    // Stable ordering and price predicates protect both stock and a price
    // change made after the quote was generated.
    for (const line of bikeLines) {
      const reserved = await tx.bike.updateMany({
        where: { id: line.bikeId!, status: "AVAILABLE", priceCents: line.unitPriceCents },
        data: { status: "RESERVED" },
      });
      if (reserved.count !== 1) {
        throw new CheckoutError(
          "Deze fiets is net niet meer beschikbaar of de prijs is gewijzigd. We hebben je niets in rekening gebracht.",
          "CART_INVALID",
        );
      }
    }
    for (const line of productLines) {
      const decremented = await tx.product.updateMany({
        where: {
          id: line.productId!,
          active: true,
          salePriceCents: line.unitPriceCents,
          stockQuantity: { gte: line.quantity },
        },
        data: { stockQuantity: { decrement: line.quantity } },
      });
      if (decremented.count !== 1) {
        throw new CheckoutError(`Nog niet genoeg voorraad voor ${line.name}, of de prijs is gewijzigd.`, "CART_INVALID");
      }
      await tx.stockMovement.create({
        data: { productId: line.productId!, change: -line.quantity, reason: "order", reference: orderNumber },
      });
    }

    const reservations = checkoutReservationRows(
      order.id,
      lines,
      { name: input.customer.name, email: input.customer.email },
      reservationExpiry,
    );
    if (reservations.length) await tx.reservation.createMany({ data: reservations });

    // Persist a local payment intent before an external call. A failure can now
    // always find and release the exact order resources it owns.
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        method: paymentMethodFor(provider.name),
        amountCents: totalCents,
        currency: "EUR",
        status: "creating",
        description: `Bestelling ${orderNumber}`,
        metadata: { orderNumber, basis: taxConfig.basis },
      },
    });
    await tx.auditLog.create({
      data: {
        action: "checkout.resources_reserved",
        entityType: "Order",
        entityId: order.id,
        meta: { orderNumber, bikeCount: reservations.length, stockLineCount: productLines.length, totalCents },
        actorType: "SYSTEM",
      },
    });
    return { order, payment };
  });

  const { order, payment } = checkout;
  const statusToken = createPaymentStatusToken(order.orderNumber);
  const resultUrl = `${env.baseUrl}/betaaling/resultaat?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(statusToken)}`;
  let paymentUrl: string | null = null;
  let externalPaymentId: string | null = null;
  try {
    const intent = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      description: `Demi Fietsen — bestelling ${order.orderNumber}`,
      amountCents: totalCents,
      currency: "EUR",
      webhookUrl: `${env.baseUrl}/api/webhooks/${provider.name}`,
      redirectUrl: resultUrl,
      cancelUrl: `${resultUrl}&status=geannuleerd`,
      metadata: { orderNumber: order.orderNumber, paymentId: payment.id },
    });
    // Preserve any returned provider reference before validating the rest of
    // the response. A malformed response with a real external payment remains
    // ambiguous and must never release the reserved stock.
    externalPaymentId = intent.providerPaymentId || null;
    if (
      !intent.providerPaymentId ||
      intent.amountCents !== totalCents ||
      intent.currency.toUpperCase() !== "EUR"
    ) {
      throw new Error("De betaalprovider gaf geen geldig bedrag, valuta of betalingskenmerk terug.");
    }
    paymentUrl = intent.paymentUrl;
    const bound = await prisma.payment.updateMany({
      where: { id: payment.id, orderId: order.id, status: "creating" },
      data: {
        providerPaymentId: intent.providerPaymentId,
        paymentUrl,
        status: intent.status,
        metadata: { orderNumber: order.orderNumber, paymentId: payment.id, basis: taxConfig.basis },
      },
    });
    if (bound.count !== 1) throw new Error("Lokale betaalintentie kon niet veilig aan de providerbetaling worden gekoppeld.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Betaling kon niet worden aangemaakt";
    if (!externalPaymentId) {
      // No provider reference was returned, so this is an actual creation
      // failure and resources can be released immediately.
      await recordPaymentFailure(payment.id, "FAILED", "creation_failed", reason).catch((releaseError) => {
        console.error("checkout payment failure release failed", releaseError);
      });
    } else {
      // A timeout after the provider accepted a request is ambiguous. Do not
      // release stock and risk selling the bike twice. Mollie's authenticated
      // metadata lets its webhook recover this binding; the normal TTL sweep
      // remains the hard upper bound if no payment is ever completed.
      await prisma.payment.updateMany({
        where: { id: payment.id, providerPaymentId: null, status: "creating" },
        data: {
          status: "provider_binding_pending",
          metadata: {
            orderNumber: order.orderNumber,
            paymentId: payment.id,
            pendingProviderPaymentId: externalPaymentId,
            basis: taxConfig.basis,
          },
        },
      }).catch((bindingError) => console.error("payment binding recovery marker failed", bindingError));
    }
    throw new CheckoutError("De betaling kon niet worden aangemaakt. Je bent niets verschuldigd.", "PROVIDER");
  }

  await clearCart(cart.id);
  await trackEvent("checkout_started", "order", order.orderNumber, { lines: lines.length, totalCents });
  await emailOrderConfirmation({
    orderNumber: order.orderNumber,
    email: input.customer.email,
    name: input.customer.name,
    totalCents,
    lines: lines.map((line) => ({ name: line.name, quantity: line.quantity })),
    paid: false,
    paymentUrl,
    deliveryMethodLabel: deliveryQuote.label,
  }).catch((error) => console.error("emailOrderConfirmation failed", error));

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
// Webhook processing (verified and retry-safe)
// ---------------------------------------------------------------------------

export interface WebhookResult {
  outcome: "processed" | "duplicate" | "ignored" | "error";
  detail?: string;
}

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
    metadata?: Record<string, unknown>;
  };
  try {
    verified = await provider.interpretWebhook(rawPayload);
  } catch (error) {
    return { outcome: "error", detail: error instanceof Error ? error.message : "interpretWebhook failed" };
  }
  if (verified.state === "open") return { outcome: "ignored", detail: "payment still open" };

  let payment = await prisma.payment.findUnique({
    where: { providerPaymentId: verified.providerPaymentId },
    include: { order: true },
  });
  const localPaymentId = verified.metadata?.paymentId;
  if (!payment && typeof localPaymentId === "string" && providerName === "mollie") {
    const recovered = await prisma.payment.updateMany({
      where: {
        id: localPaymentId,
        provider: providerName,
        providerPaymentId: null,
        status: { in: ["creating", "provider_binding_pending"] },
      },
      data: {
        providerPaymentId: verified.providerPaymentId,
        status: "open",
      },
    });
    if (recovered.count === 1) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: verified.providerPaymentId },
        include: { order: true },
      });
      if (payment) {
        await audit(
          "payment.provider_binding_recovered",
          "Payment",
          payment.id,
          { provider: providerName, providerPaymentId: verified.providerPaymentId },
          null,
        );
      }
    }
  }
  if (!payment || payment.provider !== providerName) return { outcome: "error", detail: "Onbekende betaling" };
  if (
    (verified.amountCents != null && verified.amountCents !== payment.amountCents) ||
    (verified.currency != null && verified.currency.toUpperCase() !== payment.currency.toUpperCase())
  ) {
    return { outcome: "error", detail: "Betalingsbedrag of valuta komt niet overeen" };
  }

  const externalEventId = `${verified.providerPaymentId}:${verified.state}`;
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalEventId: { provider: providerName, externalEventId } },
  });
  if (existing) {
    const leaseCutoff = new Date(Date.now() - 60_000);
    if (
      existing.status === "PROCESSED" ||
      existing.status === "DUPLICATE_IGNORED" ||
      (existing.status === "PROCESSING" && existing.updatedAt >= leaseCutoff)
    ) {
      return { outcome: "duplicate", detail: externalEventId };
    }
    const reclaimed = await prisma.webhookEvent.updateMany({
      where: {
        provider: providerName,
        externalEventId,
        OR: [
          { status: "FAILED" },
          { status: "RECEIVED" },
          { status: "PROCESSING", updatedAt: { lt: leaseCutoff } },
        ],
      },
      data: { status: "PROCESSING", error: null, processedAt: null },
    });
    if (reclaimed.count !== 1) return { outcome: "duplicate", detail: externalEventId };
  } else {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: providerName,
          externalEventId,
          type: `payment.${verified.state}`,
          payloadHash: hashPayload(rawPayload),
          status: "PROCESSING",
        },
      });
    } catch {
      return { outcome: "duplicate", detail: externalEventId };
    }
  }

  try {
    let completion: Awaited<ReturnType<typeof completeVerifiedPaymentSale>> | null = null;
    if (verified.state === "paid") {
      completion = await completeVerifiedPaymentSale(payment.id, verified.paidAt ?? null);
      if (completion.outcome === "completed") {
        await trackEvent("purchase", "order", payment.order.orderNumber, { totalCents: payment.order.totalCents });
        const lines = await prisma.orderLine.findMany({
          where: { orderId: payment.orderId },
          select: { name: true, quantity: true },
        });
        await emailOrderConfirmation({
          orderNumber: payment.order.orderNumber,
          email: payment.order.customerEmail,
          name: payment.order.customerName,
          totalCents: payment.order.totalCents,
          lines: lines.map((line) => ({ name: line.name, quantity: line.quantity })),
          paid: true,
          paymentUrl: null,
          deliveryMethodLabel: null,
        }).catch((error) => console.error("paid email failed", error));
        await emailInvoiceForOrder(payment.orderId).catch((error) => {
          console.error("paid invoice email failed", error);
        });
      }
    } else {
      const status = verified.state === "canceled" ? "CANCELLED" : verified.state === "expired" ? "EXPIRED" : "FAILED";
      await recordPaymentFailure(payment.id, status, verified.state, `provider: ${verified.state}`);
    }

    await prisma.webhookEvent.update({
      where: { provider_externalEventId: { provider: providerName, externalEventId } },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    await audit(
      "payment.webhook",
      "Payment",
      payment.id,
      {
        state: verified.state,
        orderNumber: payment.order.orderNumber,
        saleCompletion: completion?.outcome ?? null,
      },
      null,
    );
    return { outcome: "processed", detail: completion?.outcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
    // The provider can redeliver; preserving the primary transaction result is
    // more important than an observability write.
  }
}

function hashPayload(payload: unknown): string {
  try {
    return sha256Hex(JSON.stringify(payload)).slice(0, 64);
  } catch {
    return "n/a";
  }
}

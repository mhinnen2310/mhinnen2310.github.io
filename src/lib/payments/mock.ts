import { prisma } from "../prisma";
import { env } from "../env";
import type { CreatePaymentArgs, PaymentIntent, PaymentProvider, VerifiedPaymentState } from "./types";

/**
 * Deterministic mock payment provider.
 *
 * Purpose: exercise the EXACT same order/payment/webhook code paths as the
 * real provider in development and end-to-end tests — without any network.
 *
 * Security: only enabled when PAYMENT_PROVIDER=mock. The mock webhook
 * endpoint additionally refuses to run in production.
 */
export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPayment(args: CreatePaymentArgs): Promise<PaymentIntent> {
    const providerPaymentId = `mock_${Math.random().toString(36).slice(2, 10)}`;
    // paymentUrl points at the mock payment page (dev/test only).
    const redirect = new URL(args.redirectUrl);
    const statusToken = redirect.searchParams.get("token");
    const mockParams = new URLSearchParams({ payment: providerPaymentId, order: args.orderNumber });
    if (statusToken) mockParams.set("token", statusToken);
    const paymentUrl = `/betaaling/mock?${mockParams.toString()}`;
    return {
      providerPaymentId,
      amountCents: args.amountCents,
      currency: args.currency,
      paymentUrl,
      status: "open",
    };
  }

  async interpretWebhook(payload: unknown): Promise<{ providerPaymentId: string } & VerifiedPaymentState> {
    if (typeof payload !== "object" || payload === null) {
      throw new MockWebhookError("Ongeldige websignal payload");
    }
    const p = payload as { paymentId?: unknown; status?: unknown; paidAt?: unknown };
    if (typeof p.paymentId !== "string" || !p.paymentId.startsWith("mock_")) {
      throw new MockWebhookError("Ongeldige payment id");
    }
    const allowed = new Set(["paid", "canceled", "expired", "failed"]);
    if (typeof p.status !== "string" || !allowed.has(p.status)) {
      throw new MockWebhookError("Ongeldige status");
    }

    // "Identity validation" for the mock: the payment must exist in our
    // ledger. (The real provider re-fetches from the API; the mock checks
    // its own ledger instead.)
    const payment = await prisma.payment.findUnique({
      where: { providerPaymentId: p.paymentId },
    });
    if (!payment) {
      throw new MockWebhookError("Onbekende betaling");
    }
    // Let the shared webhook ledger and central sale lifecycle decide whether
    // this is a duplicate, an already-completed order or a late payment. A
    // provider notification may legitimately be retried after the order was
    // committed; rejecting it here made the mock differ from Mollie.

    switch (p.status) {
      case "paid":
        return {
          providerPaymentId: p.paymentId,
          state: "paid",
          paidAt: typeof p.paidAt === "string" ? new Date(p.paidAt) : new Date(),
          amountCents: payment.amountCents,
          currency: payment.currency,
        };
      case "canceled":
        return { providerPaymentId: p.paymentId, state: "canceled" };
      case "expired":
        return { providerPaymentId: p.paymentId, state: "expired" };
      default:
        return { providerPaymentId: p.paymentId, state: "failed" };
    }
  }

  async refund(_providerPaymentId: string, _amountCents: number | null): Promise<void> {
    // Mock: nothing to do. Order-level state is handled by the caller.
  }
}

export class MockWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockWebhookError";
  }
}

export function isMockEnabled(): boolean {
  return (
    env.paymentProvider === "mock" &&
    (!env.isProduction || env.isPreview) &&
    env.enableMockPaymentWebhook
  );
}

import { env } from "../env";
import type { CreatePaymentArgs, PaymentIntent, PaymentProvider, VerifiedPaymentState } from "./types";

/**
 * Mollie adapter (official @mollie/api-client).
 *
 * Webhook verification: Mollie does not sign webhook payloads. Per Mollie's
 * documentation the supported verification is to re-fetch the payment with
 * the API key and act on THAT state. The raw payload is used only to locate
 * the payment id; its claimed status is never trusted.
 */
export class MollieProvider implements PaymentProvider {
  readonly name = "mollie" as const;

  private client: {
    payments: {
      create(params: unknown): Promise<{
        id: string;
        amount: { value: string; currency: string };
        status: string;
        _links?: { checkout?: { href?: string } };
        datePaid?: string | null;
      }>;
      get(id: string): Promise<{
        id: string;
        amount: { value: string; currency: string };
        status: string;
        datePaid?: string | null;
      }>;
    };
    paymentRefunds: {
      create(params: unknown): Promise<unknown>;
    };
  } | null = null;

  private getClient() {
    if (this.client) return this.client;
    if (!env.mollieApiKey) {
      throw new Error("MOLLIE_API_KEY is not configured");
    }
    // Dynamic import so the package is only loaded when actually used.
    const { default: createMollieClient } = require("@mollie/api-client") as {
      default: (options: { apiKey: string }) => unknown;
    };
    this.client = createMollieClient({ apiKey: env.mollieApiKey }) as never;
    return this.client;
  }

  async createPayment(args: CreatePaymentArgs): Promise<PaymentIntent> {
    const client = this.getClient();
    const payment = await client.payments.create({
      description: args.description,
      amount: {
        value: (args.amountCents / 100).toFixed(2),
        currency: args.currency,
      },
      redirectUrl: args.redirectUrl,
      cancelUrl: args.cancelUrl,
      webhookUrl: args.webhookUrl,
      metadata: { orderId: args.orderId, orderNumber: args.orderNumber },
    });
    return {
      providerPaymentId: payment.id,
      amountCents: Math.round(parseFloat(payment.amount.value) * 100),
      currency: payment.amount.currency,
      paymentUrl: payment._links?.checkout?.href ?? null,
      status: payment.status,
    };
  }

  async interpretWebhook(payload: unknown): Promise<{ providerPaymentId: string } & VerifiedPaymentState> {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("id" in (payload as object)) ||
      typeof (payload as { id: unknown }).id !== "string"
    ) {
      throw new MollieWebhookError("Websignal ontbreekt een payment id");
    }
    const candidateId = (payload as { id: string }).id;

    // VERIFICATION: re-fetch from Mollie with our API key. Only the fetched
    // state is trusted (amount, status, datePaid).
    const client = this.getClient();
    const payment = await client.payments.get(candidateId);

    const amountCents = Math.round(parseFloat(payment.amount.value) * 100);
    switch (payment.status) {
      case "paid":
      case "succeeded":
        return {
          providerPaymentId: payment.id,
          state: "paid",
          paidAt: payment.datePaid ? new Date(payment.datePaid) : null,
          amountCents,
          currency: payment.amount.currency,
        };
      case "canceled":
        return { providerPaymentId: payment.id, state: "canceled" };
      case "expired":
        return { providerPaymentId: payment.id, state: "expired" };
      case "failed":
        return { providerPaymentId: payment.id, state: "failed" };
      default:
        return { providerPaymentId: payment.id, state: "open" };
    }
  }

  async refund(providerPaymentId: string, amountCents: number | null) {
    const client = this.getClient();
    // Mollie refunds API: the payment id is part of the request body.
    await client.paymentRefunds.create({
      paymentId: providerPaymentId,
      amount:
        amountCents != null
          ? { value: (amountCents / 100).toFixed(2), currency: "EUR" }
          : undefined,
    } as never);
  }
}

export class MollieWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MollieWebhookError";
  }
}

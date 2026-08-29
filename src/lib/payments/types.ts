/**
 * Payment provider abstraction.
 *
 * Mollie is the production provider; a deterministic mock provider powers
 * development and end-to-end tests (it exercises the exact same webhook
 * pipeline as the real provider).
 *
 * Security rules (Invariant 9):
 * - Payment state is only accepted from verified provider state.
 * - Mollie webhooks are NOT signed; Mollie's documented verification method
 *   is re-fetching the payment over an authenticated API call. We do exactly
 *   that and ignore the status claimed by the raw webhook body.
 * - All webhook processing is idempotent (WebhookEvent ledger).
 */
export interface CreatePaymentArgs {
  orderId: string;
  orderNumber: string;
  description: string;
  amountCents: number;
  currency: string;
  webhookUrl: string;
  redirectUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntent {
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  paymentUrl: string | null;
  status: string; // raw provider status
}

export type VerifiedPaymentState =
  | { state: "paid"; paidAt: Date | null; amountCents: number; currency: string }
  | { state: "canceled" | "expired" | "failed" }
  | { state: "open" };

export interface PaymentProvider {
  readonly name: "mollie" | "mock";
  createPayment(args: CreatePaymentArgs): Promise<PaymentIntent>;
  /** Verify and interpret a webhook event. MUST validate identity. */
  interpretWebhook(payload: unknown): Promise<{
    providerPaymentId: string;
    /** Provider-authenticated metadata, used only to recover a local binding. */
    metadata?: Record<string, unknown>;
  } & VerifiedPaymentState>;
  /** Admin-initiated refund. */
  refund(providerPaymentId: string, amountCents: number | null): Promise<void>;
}

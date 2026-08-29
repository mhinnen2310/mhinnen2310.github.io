import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const provider = {
    name: "mollie" as const,
    createPayment: vi.fn(),
    interpretWebhook: vi.fn(),
    refund: vi.fn(),
  };
  return {
    provider,
    completeVerifiedPaymentSale: vi.fn(),
    recordPaymentFailure: vi.fn(),
    audit: vi.fn(),
    trackEvent: vi.fn(),
    emailOrderConfirmation: vi.fn(),
    emailInvoiceForOrder: vi.fn(),
    prisma: {
      payment: { findUnique: vi.fn(), updateMany: vi.fn() },
      webhookEvent: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
      orderLine: { findMany: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("./prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./env", () => ({ env: { baseUrl: "http://example.test", reservationTtlMinutes: 30 } }));
vi.mock("./orders", () => ({
  completeVerifiedPaymentSale: mocks.completeVerifiedPaymentSale,
  recordPaymentFailure: mocks.recordPaymentFailure,
  sweepExpiredOrders: vi.fn(),
}));
vi.mock("./payments", () => ({ getPaymentProvider: () => mocks.provider }));
vi.mock("./audit", () => ({ audit: mocks.audit }));
vi.mock("./analytics", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("./email", () => ({ emailOrderConfirmation: mocks.emailOrderConfirmation }));
vi.mock("./invoices", () => ({ emailInvoiceForOrder: mocks.emailInvoiceForOrder }));

import { processProviderWebhook } from "./checkout";

const payment = {
  id: "payment-1",
  orderId: "order-1",
  provider: "mollie",
  amountCents: 120000,
  currency: "EUR",
  order: {
    orderNumber: "DF-2026-000001",
    totalCents: 120000,
    customerEmail: "jan@example.test",
    customerName: "Jan Bakker",
  },
};

describe("provider webhook lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.provider.interpretWebhook.mockResolvedValue({
      providerPaymentId: "tr_1",
      state: "paid",
      paidAt: new Date("2026-08-29T12:00:00.000Z"),
      amountCents: 120000,
      currency: "EUR",
    });
    mocks.prisma.payment.findUnique.mockResolvedValue(payment);
    mocks.prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.webhookEvent.create.mockResolvedValue({});
    mocks.prisma.webhookEvent.update.mockResolvedValue({});
    mocks.completeVerifiedPaymentSale.mockResolvedValue({
      outcome: "completed",
      invoiceId: "invoice-1",
      invoiceNumber: "DF-F-2026-00001",
    });
    mocks.prisma.orderLine.findMany.mockResolvedValue([]);
    mocks.trackEvent.mockResolvedValue(undefined);
    mocks.emailOrderConfirmation.mockResolvedValue(undefined);
    mocks.emailInvoiceForOrder.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(undefined);
    mocks.recordPaymentFailure.mockResolvedValue(true);
  });

  it("reclaims a failed webhook ledger row and completes the verified sale once", async () => {
    mocks.prisma.webhookEvent.findUnique.mockResolvedValue({
      status: "FAILED",
      updatedAt: new Date("2026-08-29T11:00:00.000Z"),
    });

    await expect(processProviderWebhook("mollie", { id: "tr_1" })).resolves.toMatchObject({
      outcome: "processed",
      detail: "completed",
    });

    expect(mocks.prisma.webhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING" }) }),
    );
    expect(mocks.completeVerifiedPaymentSale).toHaveBeenCalledWith(
      "payment-1",
      new Date("2026-08-29T12:00:00.000Z"),
    );
    expect(mocks.prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
  });

  it("routes cancelled, expired and failed payments through resource release", async () => {
    mocks.provider.interpretWebhook.mockResolvedValue({ providerPaymentId: "tr_1", state: "expired" });
    mocks.prisma.webhookEvent.findUnique.mockResolvedValue(null);

    await expect(processProviderWebhook("mollie", { id: "tr_1" })).resolves.toMatchObject({
      outcome: "processed",
    });

    expect(mocks.recordPaymentFailure).toHaveBeenCalledWith(
      "payment-1",
      "EXPIRED",
      "expired",
      "provider: expired",
    );
    expect(mocks.completeVerifiedPaymentSale).not.toHaveBeenCalled();
  });
});

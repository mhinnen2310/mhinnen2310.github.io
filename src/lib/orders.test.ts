import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    payment: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    reservation: { findMany: vi.fn(), updateMany: vi.fn() },
    bike: { findMany: vi.fn(), updateMany: vi.fn() },
    product: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
    warrantyRecord: { createMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    invoice: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    getWarrantyScopes: vi.fn().mockResolvedValue([]),
    ensureInvoicePdf: vi.fn().mockResolvedValue(null),
    createIssuedInvoiceInTx: vi.fn().mockResolvedValue({
      id: "invoice-1",
      invoiceNumber: "DF-F-2026-00001",
    }),
    getInvoiceCompanySnapshot: vi.fn().mockResolvedValue({}),
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
      warrantyRecord: { findMany: vi.fn() },
      order: { findUnique: vi.fn() },
      bike: { findUnique: vi.fn() },
    },
  };
});

vi.mock("./prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./env", () => ({ env: { reservationTtlMinutes: 30 } }));
vi.mock("./warranty", () => ({
  addMonths: (date: Date) => date,
  getWarrantyScopes: mocks.getWarrantyScopes,
}));
vi.mock("./payments", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("./invoices", () => ({
  ensureInvoicePdf: mocks.ensureInvoicePdf,
  createIssuedInvoiceInTx: mocks.createIssuedInvoiceInTx,
  getInvoiceCompanySnapshot: mocks.getInvoiceCompanySnapshot,
}));
vi.mock("./auth", () => ({ roleAtLeast: vi.fn(), }));

import { completeVerifiedPaymentSale, confirmManualPayment, recordPaymentFailure } from "./orders";

describe("payment failure resource release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (transaction: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      order: {
        id: "order-1",
        orderNumber: "DF-2026-000001",
        paymentStatus: "PENDING",
        internalNotes: null,
        lines: [
          {
            id: "line-b",
            kind: "UNIQUE_BIKE",
            bikeId: "bike-b",
            productId: null,
            name: "Bike B",
            identifier: "B",
            quantity: 1,
            unitPriceCents: 120000,
            lineTotalCents: 120000,
            taxRate: 21,
            taxCents: 0,
          },
          {
            id: "line-a",
            kind: "UNIQUE_BIKE",
            bikeId: "bike-a",
            productId: null,
            name: "Bike A",
            identifier: "A",
            quantity: 1,
            unitPriceCents: 100000,
            lineTotalCents: 100000,
            taxRate: 21,
            taxCents: 0,
          },
        ],
      },
    });
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.payment.update.mockResolvedValue({});
    mocks.tx.reservation.updateMany.mockResolvedValue({ count: 2 });
    mocks.tx.bike.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.auditLog.create.mockResolvedValue({});
  });

  it("releases every bike line, including legacy lines without a reservation row", async () => {
    await expect(recordPaymentFailure("payment-1", "FAILED", "failed", "kaart geweigerd")).resolves.toBe(true);

    expect(mocks.tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
    expect(mocks.tx.bike.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.tx.bike.updateMany.mock.calls.map(([args]) => args.where.id)).toEqual(["bike-a", "bike-b"]);
    expect(mocks.tx.bike.updateMany.mock.calls[0]?.[0].where.reservations).toEqual({
      none: { status: "ACTIVE" },
    });
  });
});

describe("central sale completion", () => {
  const paidOrder = {
    id: "order-1",
    orderNumber: "DF-2026-000001",
    paymentStatus: "PENDING",
    totalCents: 120000,
    currency: "EUR",
    internalNotes: null,
    lines: [
      {
        id: "line-a",
        kind: "UNIQUE_BIKE",
        bikeId: "bike-a",
        productId: null,
        name: "Bike A",
        identifier: "A",
        quantity: 1,
        unitPriceCents: 120000,
        lineTotalCents: 120000,
        taxRate: 21,
        taxCents: 0,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (transaction: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      amountCents: 120000,
      currency: "EUR",
      capturedAt: null,
      method: "MOCK",
      order: paidOrder,
    });
    mocks.tx.bike.findMany.mockResolvedValue([
      {
        id: "bike-a",
        status: "RESERVED",
        isElectric: true,
        batteryVoltage: 36,
        batteryWarrantyMonths: null,
      },
    ]);
    mocks.tx.reservation.findMany.mockResolvedValue([
      { id: "reservation-a", bikeId: "bike-a", expiresAt: new Date("2026-12-31T00:00:00.000Z") },
    ]);
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.bike.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.reservation.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.warrantyRecord.createMany.mockResolvedValue({ count: 0 });
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.createIssuedInvoiceInTx.mockResolvedValue({ id: "invoice-1", invoiceNumber: "DF-F-2026-00001" });
  });

  it("moves a verified payment through the one sale path and sells only its reserved bike", async () => {
    const result = await completeVerifiedPaymentSale("payment-1", new Date("2026-08-29T12:00:00.000Z"));

    expect(result).toEqual({
      outcome: "completed",
      invoiceId: "invoice-1",
      invoiceNumber: "DF-F-2026-00001",
    });
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1", paymentStatus: "PENDING" } }),
    );
    expect(mocks.tx.bike.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: "bike-a", status: "RESERVED" }),
        data: { status: "SALE_PENDING" },
      }),
    );
    expect(mocks.tx.bike.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: "bike-a",
          status: "SALE_PENDING",
          reservations: { some: { id: "reservation-a", orderId: "order-1", status: "ACTIVE" } },
        }),
        data: expect.objectContaining({ status: "SOLD", soldOrderNumber: "DF-2026-000001" }),
      }),
    );
    expect(mocks.tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: "reservation-a", orderId: "order-1", status: "ACTIVE" },
      data: { status: "CONVERTED_TO_ORDER" },
    });
    expect(mocks.createIssuedInvoiceInTx).toHaveBeenCalledTimes(1);
  });

  it("does not sell when a verified payment lacks the order's active bike reservation", async () => {
    mocks.tx.reservation.findMany.mockResolvedValue([]);

    await expect(
      completeVerifiedPaymentSale("payment-1", new Date("2026-08-29T12:00:00.000Z")),
    ).resolves.toMatchObject({ outcome: "manual_review" });

    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.bike.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paid_requires_manual_review" }) }),
    );
  });

  it("keeps a concurrently completed payment paid instead of downgrading it to manual review", async () => {
    mocks.tx.payment.findUnique
      .mockResolvedValueOnce({
        id: "payment-1",
        amountCents: 120000,
        currency: "EUR",
        capturedAt: null,
        method: "MOCK",
        order: paidOrder,
      })
      .mockResolvedValueOnce({
        id: "payment-1",
        amountCents: 120000,
        currency: "EUR",
        capturedAt: new Date("2026-08-29T12:00:00.000Z"),
        method: "MOCK",
        order: { ...paidOrder, paymentStatus: "PAID" },
      });
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.invoice.findUnique.mockResolvedValue({ id: "invoice-1", invoiceNumber: "DF-F-2026-00001" });

    await expect(
      completeVerifiedPaymentSale("payment-1", new Date("2026-08-29T12:00:00.000Z")),
    ).resolves.toMatchObject({ outcome: "already_completed" });

    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paid" }) }),
    );
    expect(mocks.tx.payment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paid_requires_manual_review" }) }),
    );
  });

  it("requires an authenticated staff member before CASH can enter the sale flow", async () => {
    await expect(confirmManualPayment("order-1", "CASH", null)).rejects.toThrow(
      "Alleen bevoegd personeel",
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bike: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  reservation: { findFirst: vi.fn(), updateMany: vi.fn() },
  transaction: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("./prisma", () => ({ prisma: { bike: mocks.bike, reservation: mocks.reservation, $transaction: mocks.transaction } }));
vi.mock("./audit", () => ({ audit: mocks.audit }));
vi.mock("./descriptions", () => ({
  defaultDescriptionContext: vi.fn(),
  generateBikeDescription: vi.fn(),
}));
vi.mock("./env", () => ({ env: { baseUrl: "http://example.test" } }));

import { setBikeStatus, unreserveBike } from "./bike-admin";

describe("manual bike sale prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({ bike: mocks.bike, reservation: mocks.reservation }));
    mocks.bike.findUnique.mockResolvedValue({
      id: "bike-1",
      inventoryCode: "2455",
      status: "AVAILABLE",
      images: [],
    });
  });

  it("refuses an admin status mutation to SOLD before any write", async () => {
    await expect(setBikeStatus("bike-1", "SOLD", null)).rejects.toThrow(
      "centrale verkoopafronding",
    );
    expect(mocks.bike.update).not.toHaveBeenCalled();
  });

  it("refuses the future sale-pending status outside the central lifecycle", async () => {
    await expect(setBikeStatus("bike-1", "SALE_PENDING", null)).rejects.toThrow("centrale lifecycle");
    expect(mocks.bike.update).not.toHaveBeenCalled();
  });

  it("releases the exact reservation requested by an admin action", async () => {
    mocks.reservation.findFirst.mockResolvedValue({ id: "reservation-2", source: "MANUAL", orderId: null });
    mocks.reservation.updateMany.mockResolvedValue({ count: 1 });
    mocks.bike.updateMany.mockResolvedValue({ count: 1 });

    await unreserveBike("bike-1", null, "AVAILABLE", "reservation-2");

    expect(mocks.reservation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "reservation-2", bikeId: "bike-1", status: "ACTIVE" },
    }));
    expect(mocks.bike.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "bike-1", status: "RESERVED" }),
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bike: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueAfterUpdate: vi.fn() },
  priceHistory: { create: vi.fn() },
  audit: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    bike: { findUnique: (...args: unknown[]) => mocks.bike.findUnique(...args), updateMany: (...args: unknown[]) => mocks.bike.updateMany(...args) },
    priceHistoryEntry: mocks.priceHistory,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      bike: { updateMany: mocks.bike.updateMany, findUnique: mocks.bike.findUniqueAfterUpdate },
      priceHistoryEntry: mocks.priceHistory,
    }),
  },
}));
vi.mock("./audit", () => ({ audit: mocks.audit }));
vi.mock("./descriptions", () => ({ defaultDescriptionContext: vi.fn(), generateBikeDescription: vi.fn() }));
vi.mock("./env", () => ({ env: { baseUrl: "http://example.test" } }));

import { updateBike } from "./bike-admin";

describe("bike price history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bike.findUnique.mockResolvedValue({ id: "bike-1", priceCents: 150_000 });
    mocks.bike.updateMany.mockResolvedValue({ count: 1 });
    mocks.bike.findUniqueAfterUpdate.mockResolvedValue({ id: "bike-1", priceCents: 140_000 });
  });

  it("writes old and new cents atomically with the conditional price update", async () => {
    await updateBike("bike-1", { priceCents: 140_000 }, { id: "staff-1", role: "STAFF", email: "staff@example.test", name: null, emailVerified: null });
    expect(mocks.bike.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "bike-1", priceCents: 150_000 } }));
    expect(mocks.priceHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldPriceCents: 150_000, newPriceCents: 140_000, changedBy: "staff-1" }) });
    expect(mocks.audit).toHaveBeenCalledWith("bike.updated", "Bike", "bike-1", expect.objectContaining({ oldPriceCents: 150_000, newPriceCents: 140_000 }), expect.anything());
  });
});

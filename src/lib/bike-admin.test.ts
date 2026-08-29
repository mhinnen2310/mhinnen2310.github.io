import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bike: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  audit: vi.fn(),
}));

vi.mock("./prisma", () => ({ prisma: { bike: mocks.bike } }));
vi.mock("./audit", () => ({ audit: mocks.audit }));
vi.mock("./descriptions", () => ({
  defaultDescriptionContext: vi.fn(),
  generateBikeDescription: vi.fn(),
}));
vi.mock("./env", () => ({ env: { baseUrl: "http://example.test" } }));

import { setBikeStatus } from "./bike-admin";

describe("manual bike sale prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

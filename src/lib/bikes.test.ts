import { describe, expect, it } from "vitest";
import { canTransition, computeMargin, daysSinceAcquisition, daysSinceAvailable, isPublicBikeStatus } from "./bikes";

describe("generic bike status transitions", () => {
  it("cannot enter lifecycle-managed reservation or sale states", () => {
    expect(canTransition("AVAILABLE", "RESERVED")).toBe(false);
    expect(canTransition("AVAILABLE", "SOLD")).toBe(false);
    expect(canTransition("RESERVED", "SOLD")).toBe(false);
    expect(canTransition("READY", "SALE_PENDING")).toBe(false);
  });

  it("keeps generic lifecycle transitions deliberate", () => {
    expect(canTransition("INTAKE", "READY")).toBe(false);
    expect(canTransition("INTAKE", "WORKSHOP")).toBe(true);
    expect(canTransition("INTAKE", "AVAILABLE")).toBe(false);
    expect(canTransition("READY", "AVAILABLE")).toBe(true);
  });

  it("calculates expected and realised margins in integer cents", () => {
    expect(computeMargin({ acquisitionCostCents: 100_000, partsCostCents: 10_000, repairCostCents: 5_000, otherCostCents: 2_500, priceCents: 175_000, realisedSalePriceCents: 169_900 })).toMatchObject({
      totalCostCents: 117_500, expectedGrossMarginCents: 57_500, grossMarginCents: 52_400,
    });
  });

  it("uses acquisition and publication dates for stock ageing", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    expect(daysSinceAcquisition({ acquisitionDate: new Date("2026-08-19T12:00:00Z"), createdAt: now }, now)).toBe(10);
    expect(daysSinceAvailable({ publishedAt: new Date("2026-08-24T12:00:00Z") }, now)).toBe(5);
    expect(daysSinceAvailable({ publishedAt: null }, now)).toBeNull();
  });

  it("never exposes intake, workshop or sale-pending records as public stock", () => {
    expect(isPublicBikeStatus("AVAILABLE")).toBe(true);
    expect(isPublicBikeStatus("RESERVED")).toBe(true);
    expect(isPublicBikeStatus("INTAKE")).toBe(false);
    expect(isPublicBikeStatus("WORKSHOP")).toBe(false);
    expect(isPublicBikeStatus("SALE_PENDING")).toBe(false);
  });
});

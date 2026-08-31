import { describe, expect, it } from "vitest";
import { BikeInputError, parseBikeCreate, parseBikeUpdate, withInitialBikeLifecycle } from "./bike-input";

const intake = {
  brand: "Gazelle", model: "Ultimate", bikeType: "Trekkingfiets", isElectric: true, colour: "Blauw", frameSerialRef: "FRAME-1",
  acquisitionCostCents: 125_000, acquisitionDate: "2026-08-29", priceCents: 199_900,
};

describe("bike admin input", () => {
  it("accepts complete minimum intake data and always starts in INTAKE", () => {
    const data = parseBikeCreate(intake);
    expect(data.title).toBe("Gazelle Ultimate");
    expect(withInitialBikeLifecycle(data).status).toBe("INTAKE");
    expect(data.acquisitionCostCents).toBe(125_000);
  });

  it("preserves P0 decimal units and rejects invalid money", () => {
    expect(parseBikeUpdate({ wheelSizeInches: 27.5, batteryAh: 13.5 })).toMatchObject({ wheelSizeInches: "27.5", batteryAh: "13.50" });
    expect(() => parseBikeUpdate({ priceCents: 12.5 })).toThrow(BikeInputError);
  });

  it("does not allow a client to submit lifecycle fields", () => {
    expect(parseBikeUpdate({ status: "SOLD", soldAt: "2026-01-01" })).toEqual({});
  });
});

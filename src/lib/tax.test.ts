import { describe, expect, it } from "vitest";
import { lineTax, marginVatCents } from "./tax";

describe("VAT and Dutch margin scheme calculations", () => {
  it("calculates VAT only on the positive margin for an inclusive bike price", () => {
    expect(lineTax(121_000, 21, "incl", { scheme: "MARGIN", acquisitionCostCents: 100_000 })).toMatchObject({
      totalCents: 121_000,
      marginCents: 21_000,
      taxCents: 3_645,
      netCents: 117_355,
      requiresCostBasis: false,
      scheme: "MARGIN",
    });
    expect(marginVatCents(121_000, 100_000, 21)).toBe(3_645);
  });

  it("does not create negative margin VAT when a bike sells below cost", () => {
    expect(lineTax(90_000, 21, "incl", { scheme: "MARGIN", acquisitionCostCents: 100_000 })).toMatchObject({
      marginCents: 0,
      taxCents: 0,
      netCents: 90_000,
      requiresCostBasis: false,
    });
  });

  it("refuses a margin sale without a recorded acquisition basis", () => {
    expect(lineTax(121_000, 21, "incl", { scheme: "MARGIN" })).toMatchObject({
      taxCents: 0,
      requiresCostBasis: true,
      marginCents: null,
    });
  });

  it("keeps standard inclusive and exclusive calculations unchanged", () => {
    expect(lineTax(121_000, 21, "incl")).toMatchObject({ netCents: 100_000, taxCents: 21_000, totalCents: 121_000, scheme: "STANDARD" });
    expect(lineTax(100_000, 21, "excl")).toMatchObject({ netCents: 100_000, taxCents: 21_000, totalCents: 121_000, scheme: "STANDARD" });
  });
});

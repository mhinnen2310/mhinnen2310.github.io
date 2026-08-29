import { describe, expect, it } from "vitest";
import { ProductInputError, parseProductCreate } from "./product-input";

describe("accessory admin input", () => {
  it("validates an accessory and its opening stock", () => {
    expect(parseProductCreate({ sku: "ACC-01", title: "Fietsslot", salePriceCents: 2995, stockQuantity: 8 })).toMatchObject({
      sku: "ACC-01", title: "Fietsslot", salePriceCents: 2995, stockQuantity: 8, lowStockThreshold: 3, active: true,
    });
  });

  it("rejects fractional cents and missing SKU", () => {
    expect(() => parseProductCreate({ title: "Slot", salePriceCents: 2995, stockQuantity: 1 })).toThrow(ProductInputError);
    expect(() => parseProductCreate({ sku: "A", title: "Slot", salePriceCents: 29.95, stockQuantity: 1 })).toThrow(ProductInputError);
  });
});

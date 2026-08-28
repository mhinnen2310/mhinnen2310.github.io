import type { LineKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { DeliveryError, quoteDelivery, type DeliveryConfig } from "./delivery";

const config: DeliveryConfig = {
  freeDeliveryAboveCents: null,
  requiresReview: false,
  methods: [
    {
      id: "pickup",
      label: "Ophalen",
      enabled: true,
      priceCents: 0,
      instructions: null,
      appliesTo: ["UNIQUE_BIKE", "STOCK_ITEM"],
      requiresAddress: false,
    },
    {
      id: "parcel",
      label: "Pakketpost",
      enabled: true,
      priceCents: 795,
      instructions: null,
      appliesTo: ["STOCK_ITEM"],
      requiresAddress: true,
    },
  ],
};

describe("quoteDelivery", () => {
  it("does not allow an accessories-only delivery method for a mixed cart", () => {
    const kinds = new Set<LineKind>(["UNIQUE_BIKE", "STOCK_ITEM"]);
    expect(() => quoteDelivery(config, "parcel", kinds, 100_000, "7552 AB")).toThrow(DeliveryError);
  });

  it("keeps the address requirement in the authoritative quote", () => {
    const quote = quoteDelivery(config, "parcel", new Set<LineKind>(["STOCK_ITEM"]), 2_000, "7552 AB");
    expect(quote.requiresAddress).toBe(true);
    expect(quote.costCents).toBe(795);
  });
});

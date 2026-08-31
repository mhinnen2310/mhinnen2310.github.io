import { describe, expect, it } from "vitest";
import {
  checkoutReservationRows,
  OrderLifecycleIntegrityError,
  uniqueBikeLinesForOrder,
} from "./order-lifecycle";

describe("unique-bike order lifecycle helpers", () => {
  const twoBikeLines = [
    { kind: "UNIQUE_BIKE" as const, bikeId: "bike-b", quantity: 1, unitPriceCents: 129900 },
    { kind: "STOCK_ITEM" as const, bikeId: null, quantity: 2, unitPriceCents: 1495 },
    { kind: "UNIQUE_BIKE" as const, bikeId: "bike-a", quantity: 1, unitPriceCents: 99900 },
  ];

  it("creates one checkout reservation for every physical bike in a stable order", () => {
    const expiry = new Date("2026-08-29T12:30:00.000Z");
    const rows = checkoutReservationRows(
      "order-1",
      twoBikeLines,
      { name: "Jan Bakker", email: "jan@example.test" },
      expiry,
    );

    expect(rows).toEqual([
      {
        bikeId: "bike-a",
        source: "CHECKOUT",
        orderId: "order-1",
        customerName: "Jan Bakker",
        customerEmail: "jan@example.test",
        expiresAt: expiry,
        status: "ACTIVE",
      },
      {
        bikeId: "bike-b",
        source: "CHECKOUT",
        orderId: "order-1",
        customerName: "Jan Bakker",
        customerEmail: "jan@example.test",
        expiresAt: expiry,
        status: "ACTIVE",
      },
    ]);
  });

  it("rejects duplicate physical bikes and quantities other than one", () => {
    expect(() =>
      uniqueBikeLinesForOrder([
        twoBikeLines[0]!,
        { kind: "UNIQUE_BIKE" as const, bikeId: "bike-b", quantity: 1, unitPriceCents: 129900 },
      ]),
    ).toThrow(OrderLifecycleIntegrityError);
    expect(() =>
      uniqueBikeLinesForOrder([
        { kind: "UNIQUE_BIKE" as const, bikeId: "bike-a", quantity: 2, unitPriceCents: 99900 },
      ]),
    ).toThrow("exact eenmaal");
  });
});

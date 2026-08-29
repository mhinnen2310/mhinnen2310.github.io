/**
 * Pure order/reservation lifecycle helpers.
 *
 * Keeping these rules independent from Prisma makes the invariants explicit
 * and lets checkout and sale completion use exactly the same definition of a
 * valid unique-bike line.
 */

export interface UniqueBikeOrderLine {
  kind: "UNIQUE_BIKE" | "STOCK_ITEM";
  bikeId: string | null;
  quantity: number;
  unitPriceCents: number;
}

export class OrderLifecycleIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderLifecycleIntegrityError";
  }
}

/**
 * A physical bike can only occur once and with quantity one in an order.
 * The returned rows are sorted to give concurrent transactions a stable
 * locking order and thereby reduce deadlock pressure.
 */
export function uniqueBikeLinesForOrder<T extends UniqueBikeOrderLine>(lines: readonly T[]): T[] {
  const seen = new Set<string>();
  const bikes: T[] = [];

  for (const line of lines) {
    if (line.kind !== "UNIQUE_BIKE") continue;
    if (!line.bikeId) {
      throw new OrderLifecycleIntegrityError("Een fietsregel mist een fiets-id.");
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity !== 1) {
      throw new OrderLifecycleIntegrityError("Een unieke fiets moet exact eenmaal in een bestelling staan.");
    }
    if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new OrderLifecycleIntegrityError("Een fietsregel heeft geen geldig bedrag in centen.");
    }
    if (seen.has(line.bikeId)) {
      throw new OrderLifecycleIntegrityError("Dezelfde fysieke fiets staat meer dan eenmaal in de bestelling.");
    }
    seen.add(line.bikeId);
    bikes.push(line);
  }

  return bikes.sort((a, b) => a.bikeId!.localeCompare(b.bikeId!));
}

export function checkoutReservationRows(
  orderId: string,
  lines: readonly UniqueBikeOrderLine[],
  customer: { name: string; email: string },
  expiresAt: Date,
) {
  return uniqueBikeLinesForOrder(lines).map((line) => ({
    bikeId: line.bikeId!,
    source: "CHECKOUT" as const,
    orderId,
    customerName: customer.name,
    customerEmail: customer.email,
    expiresAt,
    status: "ACTIVE" as const,
  }));
}

import { getCartByToken, quoteCart } from "./cart";
import { getDeliveryConfig, getEnabledMethods, quoteDelivery, DeliveryError } from "./delivery";
import { getTaxConfig, lineTax, taxRateForLine } from "./tax";
import { prisma } from "./prisma";
import type { Cart } from "@prisma/client";

/**
 * Checkout quote for the /checkout page (server-side only).
 *
 * Prices and delivery costs always come from the database/config — the
 * browser never influences totals (Invariant 5).
 */

export interface CheckoutDeliveryOption {
  id: string;
  label: string;
  costCents: number;
  instructions: string | null;
  requiresAddress: boolean;
  applicable: boolean;
  error: string | null;
}

export interface CheckoutQuoteView {
  cartId: string;
  lines: {
    id: string;
    kind: "UNIQUE_BIKE" | "STOCK_ITEM";
    name: string;
    identifier: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
    imageKey: string | null;
    available: boolean;
    issue: string | null;
  }[];
  allValid: boolean;
  issues: string[];
  subtotalCents: number;
  deliveryOptions: CheckoutDeliveryOption[];
  defaultMethodId: string | null;
  taxNote: string;
  totalCents: number;
  currency: string;
}

export async function quoteCheckout(cartToken: string | null | undefined, preferredMethodId?: string | null): Promise<CheckoutQuoteView | null> {
  const cart: Cart | null = await getCartByToken(cartToken);
  if (!cart) return null;

  const quote = await quoteCart(cart.id);
  if (quote.lines.length === 0) return null;

  const config = await getDeliveryConfig();
  const cartKinds = new Set(quote.lines.map((l) => l.kind));
  const taxConfig = await getTaxConfig();
  const bikeIds = quote.lines.filter((line) => line.kind === "UNIQUE_BIKE").map((line) => line.refId);
  const bikes = bikeIds.length ? await prisma.bike.findMany({ where: { id: { in: bikeIds } }, select: { id: true, acquisitionCostCents: true } }) : [];
  const acquisitionByBike = new Map(bikes.map((bike) => [bike.id, bike.acquisitionCostCents]));

  const deliveryOptions: CheckoutDeliveryOption[] = getEnabledMethods(config).map((m) => {
    try {
      const dq = quoteDelivery(config, m.id, cartKinds, quote.subtotalCents, null);
      return {
        id: m.id,
        label: m.label,
        costCents: dq.costCents,
        instructions: m.instructions,
        requiresAddress: dq.requiresAddress,
        applicable: true,
        error: null,
      };
    } catch (err) {
      if (err instanceof DeliveryError) {
        return {
          id: m.id,
          label: m.label,
          costCents: 0,
          instructions: null,
          requiresAddress: m.requiresAddress,
          applicable: false,
          error: err.message,
        };
      }
      throw err;
    }
  });

  const applicable = deliveryOptions.filter((o) => o.applicable);
  const defaultMethodId =
    (preferredMethodId && applicable.find((o) => o.id === preferredMethodId)?.id) ||
    applicable[0]?.id ||
    null;

  const selected = deliveryOptions.find((o) => o.id === defaultMethodId);
  const lines = quote.lines.map((line) => {
    if (line.kind === "UNIQUE_BIKE" && taxConfig.bikeScheme === "MARGIN" && acquisitionByBike.get(line.refId) == null) {
      return { ...line, available: false, issue: "Voor deze fiets ontbreekt de vastgelegde inkoopprijs voor de margeregeling." };
    }
    return line;
  });
  const basisIssues = lines.filter((line) => line.issue === "Voor deze fiets ontbreekt de vastgelegde inkoopprijs voor de margeregeling.").map((line) => `${line.name}: ${line.issue}`);
  const taxTotalCents = quote.lines.reduce((sum, line) => {
    const tax = lineTax(line.lineTotalCents, taxRateForLine(taxConfig, line.kind), taxConfig.basis, {
      scheme: line.kind === "UNIQUE_BIKE" ? taxConfig.bikeScheme : "STANDARD",
      acquisitionCostCents: line.kind === "UNIQUE_BIKE" ? acquisitionByBike.get(line.refId) : null,
    });
    return sum + tax.taxCents;
  }, 0);
  const totalCents = quote.subtotalCents + (selected?.costCents ?? 0) + (taxConfig.basis === "excl" ? taxTotalCents : 0);

  const taxNote =
    taxConfig.basis === "incl"
      ? taxConfig.bikeScheme === "MARGIN"
        ? "Fietsen vallen onder de margeregeling; btw is verwerkt in de verkoopprijs."
        : "Alle prijzen zijn inclusief btw (indien van toepassing)."
      : "Alle prijzen zijn exclusief btw; btw wordt bij de bestelling berekend.";

  return {
    cartId: cart.id,
    lines,
    allValid: quote.allValid && basisIssues.length === 0,
    issues: [...quote.issues, ...basisIssues],
    subtotalCents: quote.subtotalCents,
    deliveryOptions,
    defaultMethodId,
    taxNote,
    totalCents,
    currency: "EUR",
  };
}

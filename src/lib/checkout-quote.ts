import { getCartByToken, quoteCart } from "./cart";
import { getDeliveryConfig, getEnabledMethods, quoteDelivery, DeliveryError } from "./delivery";
import { getTaxConfig } from "./tax";
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
  const totalCents =
    quote.subtotalCents + (selected?.costCents ?? 0) + (taxConfig.basis === "excl" ? quote.lines.reduce((s, l) => s + Math.round((l.lineTotalCents * (l.kind === "UNIQUE_BIKE" ? taxConfig.bikeRate : taxConfig.accessoryRate)) / 100), 0) : 0);

  const taxNote =
    taxConfig.basis === "incl"
      ? "Alle prijzen zijn inclusief btw (indien van toepassing)."
      : "Alle prijzen zijn exclusief btw; btw wordt bij de bestelling berekend.";

  return {
    cartId: cart.id,
    lines: quote.lines,
    allValid: quote.allValid,
    issues: quote.issues,
    subtotalCents: quote.subtotalCents,
    deliveryOptions,
    defaultMethodId,
    taxNote,
    totalCents,
    currency: "EUR",
  };
}

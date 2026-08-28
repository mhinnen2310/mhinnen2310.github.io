import { prisma } from "./prisma";
import type { LineKind } from "@prisma/client";

/**
 * Configurable delivery methods (SiteSettings.delivery).
 * Nothing is hardcoded: methods, prices, applicability and instructions all
 * come from admin configuration.
 */
export interface DeliveryMethod {
  id: string;
  label: string;
  enabled: boolean;
  priceCents: number;
  instructions: string | null;
  appliesTo: LineKind[];
  /** Whether a delivery address is required to complete the order. */
  requiresAddress: boolean;
  postcodePrefixes?: string[]; // optional region logic
}

export interface DeliveryConfig {
  methods: DeliveryMethod[];
  freeDeliveryAboveCents: number | null;
  requiresReview: boolean;
}

export const DEFAULT_DELIVERY: DeliveryConfig = {
  methods: [
    {
      id: "pickup",
      label: "Ophalen bij Demi Fietsen",
      enabled: true,
      priceCents: 0,
      instructions: "We maken een afspraak voor ophaling nadat je veilig online hebt betaald.",
      appliesTo: ["UNIQUE_BIKE", "STOCK_ITEM"],
      requiresAddress: false,
    },
    {
      id: "local-delivery",
      label: "Levering op locatie (binnen regio)",
      enabled: true,
      priceCents: 3900,
      instructions: "Levering in de directe omgeving, in overleg.",
      appliesTo: ["UNIQUE_BIKE"],
      requiresAddress: true,
    },
    {
      id: "parcel",
      label: "Verzenden (accessoires)",
      enabled: true,
      priceCents: 795,
      instructions: "Accessoires worden als pakket verzonden.",
      appliesTo: ["STOCK_ITEM"],
      requiresAddress: true,
    },
  ],
  freeDeliveryAboveCents: null,
  requiresReview: true,
};

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const s = await prisma.siteSettings.findFirst();
  if (!s?.delivery) return DEFAULT_DELIVERY;
  const raw = s.delivery as Partial<DeliveryConfig> & { methods?: Partial<DeliveryMethod>[] };
  const methods = (raw.methods ?? DEFAULT_DELIVERY.methods).map((m) => ({
    id: m.id,
    label: m.label,
    enabled: m.enabled !== false,
    priceCents: typeof m.priceCents === "number" ? m.priceCents : 0,
    instructions: m.instructions ?? null,
    appliesTo: m.appliesTo?.length ? m.appliesTo : DEFAULT_DELIVERY.methods.find((d) => d.id === m.id)?.appliesTo ?? ["STOCK_ITEM"],
    requiresAddress:
      typeof m.requiresAddress === "boolean"
        ? m.requiresAddress
        : (DEFAULT_DELIVERY.methods.find((d) => d.id === m.id)?.requiresAddress ?? (m.id !== "pickup")),
    postcodePrefixes: m.postcodePrefixes,
  }));
  return {
    methods,
    freeDeliveryAboveCents:
      typeof raw.freeDeliveryAboveCents === "number" ? raw.freeDeliveryAboveCents : null,
    requiresReview: raw.requiresReview !== false,
  };
}

export function getEnabledMethods(config: DeliveryConfig): DeliveryMethod[] {
  return config.methods.filter((m) => m.enabled);
}

export interface DeliveryQuote {
  methodId: string;
  label: string;
  costCents: number;
  instructions: string | null;
  requiresAddress: boolean;
}

/**
 * Quote delivery for a cart. Server-side only; the client never sets the cost.
 */
export function quoteDelivery(
  config: DeliveryConfig,
  methodId: string,
  cartKinds: Set<LineKind>,
  subtotalCents: number,
  postcode: string | null,
): DeliveryQuote {
  const method = config.methods.find((m) => m.id === methodId);
  if (!method || !method.enabled) {
    throw new DeliveryError("Deze leveringsmethode is niet beschikbaar.");
  }
  // A single delivery method must cover every item in a mixed cart. For
  // example, an accessories-only parcel method may not be used for a bike.
  const applicable = [...cartKinds].every((k) => method.appliesTo.includes(k));
  if (!applicable) {
    throw new DeliveryError(`"${method.label}" geldt niet voor de items in je winkelwagen.`);
  }
  if (method.postcodePrefixes?.length && postcode) {
    const normalized = postcode.toUpperCase().replace(/\s/g, "");
    const inRegion = method.postcodePrefixes.some((p) => normalized.startsWith(p.toUpperCase()));
    if (!inRegion) {
      throw new DeliveryError(`"${method.label}" is alleen mogelijk in de regio ${method.postcodePrefixes.join(", ")}.`);
    }
  }
  const free =
    config.freeDeliveryAboveCents != null && subtotalCents >= config.freeDeliveryAboveCents;
  return {
    methodId: method.id,
    label: method.label,
    costCents: free ? 0 : method.priceCents,
    instructions: method.instructions,
    requiresAddress: method.requiresAddress,
  };
}

export class DeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryError";
  }
}

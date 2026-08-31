import { prisma } from "./prisma";
import type { LineKind } from "@prisma/client";

/**
 * Configurable VAT engine.
 *
 * IMPORTANT: Dutch VAT treatment for second-hand goods (e.g. the
 * "marge-systeem" for used cars/bikes) depends on the company's accounting
 * situation. Nothing here is tax advice; rates and basis are configuration,
 * not code, and the admin UI marks them as "vereist controle door de
 * accountant".
 *
 * Tax config shape (SiteSettings.tax):
 * {
 *   "basis": "incl" | "excl",          // is the listed price incl. or excl. VAT
 *   "bikeRate": 21,                    // percent
 *   "accessoryRate": 21,
 *   "requiresReview": true
 * }
 *
 * All order lines carry a snapshot of the rate applied, so invoices remain
 * valid even if configuration changes later.
 */
export type BikeTaxScheme = "MARGIN" | "STANDARD";

export interface TaxConfig {
  basis: "incl" | "excl";
  bikeRate: number;
  accessoryRate: number;
  bikeScheme: BikeTaxScheme;
  requiresReview: boolean;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  basis: "incl",
  bikeRate: 21,
  accessoryRate: 21,
  bikeScheme: "MARGIN",
  requiresReview: true,
};

export async function getTaxConfig(): Promise<TaxConfig> {
  const s = await prisma.siteSettings.findFirst();
  if (!s?.tax) return DEFAULT_TAX_CONFIG;
  const raw = s.tax as Record<string, unknown>;
  return {
    basis: raw.basis === "excl" ? "excl" : "incl",
    bikeRate: typeof raw.bikeRate === "number" ? raw.bikeRate : 21,
    accessoryRate: typeof raw.accessoryRate === "number" ? raw.accessoryRate : 21,
    bikeScheme: raw.bikeScheme === "STANDARD" ? "STANDARD" : "MARGIN",
    requiresReview: raw.requiresReview !== false,
  };
}

export function taxRateForLine(config: TaxConfig, kind: LineKind): number {
  return kind === "UNIQUE_BIKE" ? config.bikeRate : config.accessoryRate;
}

export interface LineTaxResult {
  netCents: number;
  taxCents: number;
  totalCents: number;
  rate: number;
  scheme: BikeTaxScheme | "STANDARD";
  marginCents: number | null;
  requiresCostBasis: boolean;
}

/**
 * Compute tax for a single line.
 * basis "incl": listed total is VAT-inclusive -> net = total / (1+r)
 * basis "excl": listed total is VAT-exclusive -> total = net * (1+r)
 */
export function lineTax(
  totalCents: number,
  ratePercent: number,
  basis: "incl" | "excl",
  options: { scheme?: BikeTaxScheme; acquisitionCostCents?: number | null } = {},
): LineTaxResult {
  const scheme = options.scheme ?? "STANDARD";
  if (scheme === "MARGIN") {
    // The Dutch margin scheme is an inclusive price regime: VAT is due only
    // on the positive difference between sale price and acquisition price.
    // Without a recorded acquisition price we refuse to invent a tax basis.
    if (basis !== "incl") throw new Error("De margeregeling vereist verkoopprijzen inclusief btw.");
    const purchase = options.acquisitionCostCents;
    if (purchase == null) return { netCents: totalCents, taxCents: 0, totalCents, rate: ratePercent, scheme, marginCents: null, requiresCostBasis: true };
    const marginCents = Math.max(0, totalCents - purchase);
    const taxCents = Math.round((marginCents * ratePercent) / (100 + ratePercent));
    return { netCents: totalCents - taxCents, taxCents, totalCents, rate: ratePercent, scheme, marginCents, requiresCostBasis: false };
  }
  const r = ratePercent / 100;
  if (basis === "incl") {
    const net = Math.round(totalCents / (1 + r));
    return { netCents: net, taxCents: totalCents - net, totalCents, rate: ratePercent, scheme: "STANDARD", marginCents: null, requiresCostBasis: false };
  }
  const tax = Math.round(totalCents * r);
  return { netCents: totalCents, taxCents: tax, totalCents: totalCents + tax, rate: ratePercent, scheme: "STANDARD", marginCents: null, requiresCostBasis: false };
}

/** VAT component of a positive margin, expressed in integer cents. */
export function marginVatCents(saleCents: number, acquisitionCents: number, ratePercent = 21): number {
  const margin = Math.max(0, saleCents - acquisitionCents);
  return Math.round((margin * ratePercent) / (100 + ratePercent));
}

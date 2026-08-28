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
export interface TaxConfig {
  basis: "incl" | "excl";
  bikeRate: number;
  accessoryRate: number;
  requiresReview: boolean;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  basis: "incl",
  bikeRate: 21,
  accessoryRate: 21,
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
}

/**
 * Compute tax for a single line.
 * basis "incl": listed total is VAT-inclusive -> net = total / (1+r)
 * basis "excl": listed total is VAT-exclusive -> total = net * (1+r)
 */
export function lineTax(totalCents: number, ratePercent: number, basis: "incl" | "excl"): LineTaxResult {
  const r = ratePercent / 100;
  if (basis === "incl") {
    const net = Math.round(totalCents / (1 + r));
    return { netCents: net, taxCents: totalCents - net, totalCents, rate: ratePercent };
  }
  const tax = Math.round(totalCents * r);
  return { netCents: totalCents, taxCents: tax, totalCents: totalCents + tax, rate: ratePercent };
}

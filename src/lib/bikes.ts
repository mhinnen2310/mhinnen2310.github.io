import type { Bike, BikeStatus } from "@prisma/client";
import { numericValue } from "./utils";

/**
 * Bicycle domain rules.
 *
 * Invariant: a Bike is ONE physical object. No variants, no quantity.
 */

// --- Feature catalog (canonical keys -> Dutch labels) -----------------------

export const FEATURES: { key: string; label: string }[] = [
  { key: "charger", label: "Oplader" },
  { key: "lock", label: "Fietsenslot" },
  { key: "lights", label: "Werkende verlichting" },
  { key: "frontSuspension", label: "Vorkvering" },
  { key: "suspensionSeatpost", label: "Geveerde zadelbuis" },
  { key: "frontRack", label: "Voorstel" },
  { key: "rearRack", label: "Achterstel" },
  { key: "panniers", label: "Tassen" },
  { key: "goodTyres", label: "Goede banden" },
  { key: "walkAssist", label: "Loopassistent/throttle" },
  { key: "bell", label: "Bel" },
  { key: "bottleHolder", label: "Fleshouder" },
  { key: "fenders", label: "Spatschermen" },
  { key: "stand", label: "Centrale stander" },
];

export const FEATURE_CATALOG: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label]),
);

export function featureLabel(key: string): string {
  return FEATURE_CATALOG[key] ?? key;
}

// --- Status lifecycle --------------------------------------------------------

export const BIKE_STATUSES: BikeStatus[] = [
  "INTAKE",
  "WORKSHOP",
  "READY",
  "AVAILABLE",
  "RESERVED",
  "SALE_PENDING",
  "SOLD",
  "ARCHIVED",
];

const STATUS_LABELS: Record<BikeStatus, string> = {
  INTAKE: "Intake",
  WORKSHOP: "Werkplaats",
  READY: "Klaar",
  AVAILABLE: "Beschikbaar",
  RESERVED: "Gereserveerd",
  SALE_PENDING: "Verkoop wordt afgerond",
  SOLD: "Verkocht",
  ARCHIVED: "Gearchiveerd",
};

export function bikeStatusLabel(status: BikeStatus): string {
  return STATUS_LABELS[status];
}

/** The only bike states that may have a public detail page. */
export function isPublicBikeStatus(status: BikeStatus): boolean {
  return status === "AVAILABLE" || status === "RESERVED" || status === "SOLD" || status === "ARCHIVED";
}

const ALLOWED_TRANSITIONS: Record<BikeStatus, BikeStatus[]> = {
  // A bike must always be inspected in the workshop before it can be ready.
  INTAKE: ["WORKSHOP", "ARCHIVED"],
  WORKSHOP: ["INTAKE", "READY", "ARCHIVED"],
  READY: ["WORKSHOP", "AVAILABLE", "ARCHIVED"],
  // RESERVED, SALE_PENDING and SOLD are lifecycle-managed states. Generic admin mutation
  // must not enter/leave them; reservation and sale flows do so atomically.
  AVAILABLE: ["READY", "WORKSHOP", "ARCHIVED"],
  RESERVED: [],
  SALE_PENDING: [],
  SOLD: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: BikeStatus, to: BikeStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- Public view (Invariant 6: no private data leaves the server) ------------

export interface BikePublic {
  id: string;
  slug: string;
  inventoryCode: string;
  title: string;
  brand: string;
  model: string;
  variant: string | null;
  modelYear: number | null;
  bikeType: string | null;
  isElectric: boolean;
  frameStyle: string | null;
  genderStyle: string | null;
  colour: string | null;
  frameSizeCm: number | null;
  wheelSizeInches: number | null;
  gears: number | null;
  assistanceLevels: number | null;
  brakeInfo: string | null;
  drivetrainInfo: string | null;
  motorManufacturer: string | null;
  motorModel: string | null;
  motorPosition: string | null;
  motorDescription: string | null;
  nominalVoltage: number | null;
  walkAssist: boolean | null;
  electricalNotes: string | null;
  batteryType: string | null;
  batteryVoltage: number | null;
  batteryAh: number | null;
  batteryWh: number | null;
  batteryCondition: string | null;
  batteryReconditioned: boolean | null;
  rangeMinKm: number | null;
  rangeMaxKm: number | null;
  conditionGrade: string | null;
  conditionDescription: string | null;
  cosmeticDefects: string | null;
  technicalDefects: string | null;
  repairSummary: string | null;
  description: string | null;
  features: string[];
  priceCents: number;
  previousPriceCents: number | null;
  saleLabel: string | null;
  status: BikeStatus;
  publishedAt: Date | null;
  createdAt: Date;
  coverImage: string | null;
  imageCount: number;
  warrantyMonths: number | null;
}

/**
 * Build a sanitized public representation. This is the ONLY shape that may
 * reach the storefront. Private fields (costs, serials, supplier, internal
 * notes, battery serial) are intentionally absent.
 */
export function toPublicBike(
  bike: Bike & { _count?: { images: number }; coverImage?: { storageKey: string } | null; batteryWarrantyMonths?: number | null },
): BikePublic {
  const b = bike as unknown as Record<string, unknown>;
  const pick = <T>(k: string): T => b[k] as T;
  return {
    id: pick("id"),
    slug: pick("slug"),
    inventoryCode: pick("inventoryCode"),
    title: pick("title"),
    brand: pick("brand"),
    model: pick("model"),
    variant: pick("variant") ?? null,
    modelYear: pick("modelYear") ?? null,
    bikeType: pick("bikeType") ?? null,
    isElectric: pick("isElectric"),
    frameStyle: pick("frameStyle") ?? null,
    genderStyle: pick("genderStyle") ?? null,
    colour: pick("colour") ?? null,
    frameSizeCm: pick("frameSizeCm") ?? null,
    wheelSizeInches: numericValue(pick("wheelSizeInches")),
    gears: pick("gears") ?? null,
    assistanceLevels: pick("assistanceLevels") ?? null,
    brakeInfo: pick("brakeInfo") ?? null,
    drivetrainInfo: pick("drivetrainInfo") ?? null,
    motorManufacturer: pick("motorManufacturer") ?? null,
    motorModel: pick("motorModel") ?? null,
    motorPosition: pick("motorPosition") ?? null,
    motorDescription: pick("motorDescription") ?? null,
    nominalVoltage: pick("nominalVoltage") ?? null,
    walkAssist: pick("walkAssist") ?? null,
    electricalNotes: pick("electricalNotes") ?? null,
    batteryType: pick("batteryType") ?? null,
    batteryVoltage: pick("batteryVoltage") ?? null,
    batteryAh: numericValue(pick("batteryAh")),
    batteryWh: pick("batteryWh") ?? null,
    batteryCondition: pick("batteryCondition") ?? null,
    batteryReconditioned: pick("batteryReconditioned") ?? null,
    rangeMinKm: pick("rangeMinKm") ?? null,
    rangeMaxKm: pick("rangeMaxKm") ?? null,
    conditionGrade: pick("conditionGrade") ?? null,
    conditionDescription: pick("conditionDescription") ?? null,
    cosmeticDefects: pick("cosmeticDefects") ?? null,
    technicalDefects: pick("technicalDefects") ?? null,
    repairSummary: pick("repairSummary") ?? null,
    description: pick("description") ?? null,
    features: Array.isArray(b["features"]) ? (b["features"] as string[]) : [],
    priceCents: pick("priceCents"),
    previousPriceCents: pick("previousPriceCents") ?? null,
    saleLabel: pick("saleLabel") ?? null,
    status: pick("status"),
    publishedAt: pick("publishedAt") ?? null,
    createdAt: pick("createdAt"),
    coverImage: (bike.coverImage as { storageKey: string } | null | undefined)?.storageKey ?? null,
    imageCount: bike._count?.images ?? 0,
    warrantyMonths: bike.batteryWarrantyMonths ?? null,
  };
}

// --- Margins (admin-only) -----------------------------------------------------

export interface MarginBreakdown {
  acquisitionCostCents: number;
  partsCostCents: number;
  repairCostCents: number;
  otherCostCents: number;
  totalCostCents: number;
  askingPriceCents: number;
  expectedGrossMarginCents: number | null;
  expectedMarginPercent: number | null;
  realisedSalePriceCents: number | null;
  grossMarginCents: number | null;
  marginPercent: number | null;
}

export function computeMargin(bike: {
  acquisitionCostCents: number | null;
  partsCostCents: number;
  repairCostCents: number;
  otherCostCents: number;
  priceCents: number;
  realisedSalePriceCents: number | null;
}): MarginBreakdown {
  const acquisition = bike.acquisitionCostCents ?? 0;
  const totalCost = acquisition + (bike.partsCostCents ?? 0) + (bike.repairCostCents ?? 0) + (bike.otherCostCents ?? 0);
  const asking = bike.priceCents;
  const sold = bike.realisedSalePriceCents;
  const marginPercent = (revenueCents: number | null) =>
    revenueCents != null && totalCost > 0
      ? Math.round(((revenueCents - totalCost) / totalCost) * 1000) / 10
      : null;
  return {
    acquisitionCostCents: acquisition,
    partsCostCents: bike.partsCostCents ?? 0,
    repairCostCents: bike.repairCostCents ?? 0,
    otherCostCents: bike.otherCostCents ?? 0,
    totalCostCents: totalCost,
    askingPriceCents: asking,
    expectedGrossMarginCents: asking > 0 ? asking - totalCost : null,
    expectedMarginPercent: asking > 0 ? marginPercent(asking) : null,
    realisedSalePriceCents: sold,
    grossMarginCents: sold != null ? sold - totalCost : null,
    marginPercent: marginPercent(sold),
  };
}

/** Days since acquisition, falling back to dossier creation for legacy stock. */
export function daysSinceAcquisition(
  bike: { acquisitionDate: Date | null; createdAt: Date },
  end: Date = new Date(),
): number {
  const start = bike.acquisitionDate ?? bike.createdAt;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

/** Days since first publication as AVAILABLE; null before a bike is listed. */
export function daysSinceAvailable(
  bike: { publishedAt: Date | null },
  end: Date = new Date(),
): number | null {
  if (!bike.publishedAt) return null;
  return Math.max(0, Math.floor((end.getTime() - bike.publishedAt.getTime()) / 86_400_000));
}

// --- Similar bikes (deterministic, no ML) -------------------------------------

export interface SimilarMatch {
  bike: Bike;
  score: number;
  reasons: string[];
}

export function scoreSimilarBike(target: Bike, candidate: Bike): SimilarMatch | null {
  if (target.id === candidate.id) return null;
  if (candidate.status !== "AVAILABLE") return null;
  let score = 0;
  const reasons: string[] = [];

  if (target.brand && candidate.brand === target.brand) {
    score += 30;
    reasons.push("zelfde merk");
  }
  if (target.bikeType && candidate.bikeType === target.bikeType) {
    score += 15;
    reasons.push("zelfde type");
  }
  if (target.frameSizeCm != null && candidate.frameSizeCm != null) {
    const diff = Math.abs(candidate.frameSizeCm - target.frameSizeCm);
    if (diff === 0) {
      score += 25;
      reasons.push("zelfde framemaat");
    } else if (diff <= 2) {
      score += 12;
    }
  }
  const priceDiff =
    target.priceCents > 0 ? Math.abs(candidate.priceCents - target.priceCents) / target.priceCents : 1;
  if (priceDiff <= 0.15) {
    score += 20;
    reasons.push("gelijk prijsniveau");
  } else if (priceDiff <= 0.3) {
    score += 8;
  }
  if (target.isElectric === candidate.isElectric) score += 5;

  return score >= 25 ? { bike: candidate, score, reasons } : null;
}

export function pickSimilarBikes(target: Bike, candidates: Bike[], limit = 3): SimilarMatch[] {
  return candidates
    .map((c) => scoreSimilarBike(target, c))
    .filter((m): m is SimilarMatch => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

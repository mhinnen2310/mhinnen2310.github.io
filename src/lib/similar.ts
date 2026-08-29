import { prisma } from "./prisma";
import type { Bike } from "@prisma/client";
import { toPublicBike, type BikePublic } from "@/lib/bikes";

/**
 * Deterministic "similar bikes" matching (spec 47).
 *
 * Scores AVAILABLE bikes against the reference bike on: brand, bike type,
 * frame size proximity and price band. No ML, no external services — just
 * stable, explainable rules. Used on sold-bike pages and in Admin.
 */
export async function pickSimilarBikes(reference: Pick<Bike, "id" | "brand" | "bikeType" | "frameSizeCm" | "priceCents" | "isElectric">, limit = 4): Promise<BikePublic[]> {
  const candidates =
    await prisma.bike.findMany({
      where: { status: "AVAILABLE", id: { not: reference.id } },
      select: {
        id: true,
        inventoryCode: true,
        slug: true,
        title: true,
        brand: true,
        model: true,
        bikeType: true,
        isElectric: true,
        frameStyle: true,
        genderStyle: true,
        colour: true,
        frameSizeCm: true,
        wheelSizeInches: true,
        gears: true,
        assistanceLevels: true,
        brakeInfo: true,
        drivetrainInfo: true,
        motorManufacturer: true,
        motorModel: true,
        motorPosition: true,
        motorDescription: true,
        nominalVoltage: true,
        walkAssist: true,
        electricalNotes: true,
        batteryType: true,
        batteryVoltage: true,
        batteryAh: true,
        batteryWh: true,
        batteryCondition: true,
        batteryReconditioned: true,
        rangeMinKm: true,
        rangeMaxKm: true,
        conditionGrade: true,
        conditionDescription: true,
        cosmeticDefects: true,
        technicalDefects: true,
        repairSummary: true,
        description: true,
        features: true,
        priceCents: true,
        previousPriceCents: true,
        saleLabel: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        _count: { select: { images: { where: { isInternal: false } } } },
        images: { where: { isInternal: false }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { storageKey: true, altText: true } },
      },
      take: 40,
    });

  const scored = candidates.map((c) => {
    let score = 0;
    if (c.brand.toLowerCase() === reference.brand.toLowerCase()) score += 3;
    if (reference.bikeType && c.bikeType && c.bikeType.toLowerCase() === reference.bikeType.toLowerCase()) score += 2;
    if (reference.isElectric === c.isElectric) score += 1;
    if (reference.frameSizeCm && c.frameSizeCm) {
      const d = Math.abs(c.frameSizeCm - reference.frameSizeCm);
      if (d === 0) score += 3;
      else if (d <= 2) score += 2;
      else if (d <= 4) score += 1;
    }
    if (reference.priceCents > 0) {
      const ratio = c.priceCents / reference.priceCents;
      if (ratio >= 0.7 && ratio <= 1.3) score += 2;
    }
    return { c, score };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.c.publishedAt?.getTime() ?? 0) - (a.c.publishedAt?.getTime() ?? 0) ||
      a.c.inventoryCode.localeCompare(b.c.inventoryCode),
  );

  return scored
    .slice(0, limit)
    .map(({ c }) => toPublicBike({ ...c, coverImage: c.images[0] ?? null } as never));
}

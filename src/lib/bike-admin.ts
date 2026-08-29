import { prisma } from "./prisma";
import type { Bike, BikeStatus } from "@prisma/client";
import { canTransition } from "./bikes";
import { generateBikeDescription, defaultDescriptionContext } from "./descriptions";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { env } from "./env";
import { addWorkshopTask, completeWorkshopTask, getIntakeReadiness, getWorkshopReadiness, WorkshopError } from "./workshop";

/**
 * Admin operations on unique bikes (specs 7, 8, 46, 47).
 *
 * Generic admin status changes deliberately exclude reservation and sale
 * lifecycle transitions. A physical bike may become SOLD only from the
 * central order sale-completion flow in orders.ts.
 */

export class BikeAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BikeAdminError";
  }
}

// --- Status transitions ---------------------------------------------------------

export interface PublishCheck {
  ready: boolean;
  missing: string[];
}

/** "Ready for listing" checklist (spec 7). */
export async function checkPublishable(
  bike: Bike & { images: { id: string; isInternal: boolean }[] },
): Promise<PublishCheck> {
  const missing: string[] = [];
  if (!bike.priceCents || bike.priceCents <= 0) missing.push("Vraagprijs invullen");
  if (!bike.images?.some((image) => !image.isInternal)) missing.push("Minimaal 1 publieke foto toevoegen");
  // Untouched descriptions are generated at publication time. An intentionally
  // cleared editor field is never silently published as an empty advert.
  if (!bike.description?.trim() && bike.descriptionTouched) missing.push("Winkelbeschrijving invullen");
  if (!bike.title?.trim()) missing.push("Titel controleren");
  return { ready: missing.length === 0, missing };
}

export async function setBikeStatus(
  bikeId: string,
  to: BikeStatus,
  actor: SessionUser | null,
  opts?: { note?: string | null },
): Promise<Bike> {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId }, include: { images: true } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  if (bike.status === to) return bike;
  if (to === "SOLD") {
    throw new BikeAdminError("Een fiets kan alleen via de centrale verkoopafronding als verkocht worden gemarkeerd.");
  }
  if (to === "RESERVED" || to === "SALE_PENDING" || bike.status === "RESERVED" || bike.status === "SALE_PENDING") {
    throw new BikeAdminError("Reserveringen en verkoopafronding verlopen uitsluitend via de centrale lifecycle.");
  }
  if (!canTransition(bike.status, to)) {
    throw new BikeAdminError(`Statuswijziging ${bike.status} -> ${to} is niet toegestaan.`);
  }

  const data: Record<string, unknown> = { status: to };

  if (to === "WORKSHOP") {
    const intake = await getIntakeReadiness(bikeId);
    if (!intake.ready) throw new BikeAdminError(`De intake is nog niet compleet: ${intake.missing.join(", ")}.`);
  }
  if (to === "READY") {
    const workshop = await getWorkshopReadiness(bikeId);
    if (!workshop.ready) throw new BikeAdminError(`De inspectiechecklist is nog niet compleet: ${workshop.missing.join(", ")}.`);
  }

  if (to === "AVAILABLE") {
    const check = await checkPublishable(bike);
    if (!check.ready) {
      throw new BikeAdminError(`Deze fiets kan nog niet worden gepubliceerd: ${check.missing.join(", ")}.`);
    }
    data.publishedAt = bike.publishedAt ?? new Date();
    if (!bike.description?.trim() && !bike.descriptionTouched) {
      const ctx = await defaultDescriptionContext();
      data.description = generateBikeDescription(bike, ctx);
    }
  }

  const changed = await prisma.bike.updateMany({ where: { id: bike.id, status: bike.status }, data });
  if (changed.count !== 1) {
    throw new BikeAdminError("De status wijzigde gelijktijdig; ververs het fietsdossier en probeer opnieuw.");
  }
  const updated = await prisma.bike.findUnique({ where: { id: bike.id } });
  if (!updated) throw new BikeAdminError("Fiets niet gevonden.");
  await audit(
    `bike.status:${bike.status}->${to}`,
    "Bike",
    bike.id,
    { inventoryCode: bike.inventoryCode, note: opts?.note ?? null },
    actor,
  );
  return updated;
}

// --- Reservation (manual / appointment) -----------------------------------------

export interface ReserveInput {
  source: "MANUAL" | "APPOINTMENT";
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  expiresInMinutes?: number;
}

export async function reserveBike(bikeId: string, input: ReserveInput, actor: SessionUser | null): Promise<void> {
  const ttl = input.expiresInMinutes ?? 24 * 7; // manual holds: 7 days max
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 24 * 7) {
    throw new BikeAdminError("Een handmatige reservering moet tussen 1 minuut en 7 dagen duren.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.bike.updateMany({
        where: { id: bikeId, status: { in: ["AVAILABLE", "READY"] } },
        data: { status: "RESERVED" },
      });
      if (updated.count !== 1) {
        throw new BikeAdminError("Deze fiets kan niet gereserveerd worden (status wijzigde gelijktijdig of de fiets bestaat niet).");
      }
      await tx.reservation.create({
        data: {
          bikeId,
          source: input.source,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
          customerPhone: input.customerPhone ?? null,
          note: input.note ?? null,
          expiresAt: new Date(Date.now() + ttl * 60_000),
          status: "ACTIVE",
        },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new BikeAdminError("Deze fiets heeft al een actieve reservering.");
    }
    throw error;
  }
  await audit("bike.reserved", "Bike", bikeId, { source: input.source }, actor);
}

export async function unreserveBike(bikeId: string, actor: SessionUser | null, to: "AVAILABLE" | "READY" = "AVAILABLE"): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({
      where: { bikeId, status: "ACTIVE" },
      select: { id: true, source: true, orderId: true },
    });
    if (!reservation) throw new BikeAdminError("Deze fiets heeft geen actieve reservering.");
    if (reservation.orderId || reservation.source === "CHECKOUT") {
      throw new BikeAdminError("Een checkout-reservering kan alleen via de order-/betalingslifecycle worden vrijgegeven.");
    }
    const released = await tx.reservation.updateMany({
      where: { id: reservation.id, status: "ACTIVE", orderId: null },
      data: { status: "RELEASED" },
    });
    if (released.count !== 1) throw new BikeAdminError("De reservering wijzigde gelijktijdig.");
    const updated = await tx.bike.updateMany({
      where: { id: bikeId, status: "RESERVED", reservations: { none: { status: "ACTIVE" } } },
      data: { status: to },
    });
    if (updated.count !== 1) throw new BikeAdminError("De fiets kan niet veilig worden vrijgegeven.");
  });
  await audit(`bike.unreserved:${to}`, "Bike", bikeId, null, actor);
}

// --- Workshop tasks ---------------------------------------------------------------

export interface ServiceTaskInput {
  description: string;
  partCostCents?: number | null;
  quantity?: number;
  doneDate?: Date | null;
  internalNotes?: string | null;
  completed?: boolean;
}

export async function addServiceTask(bikeId: string, input: ServiceTaskInput, actor: SessionUser | null) {
  try {
    await addWorkshopTask(bikeId, input, actor);
  } catch (error) {
    if (error instanceof WorkshopError) throw new BikeAdminError(error.message);
    throw error;
  }
}

export async function setTaskCompleted(bikeId: string, taskId: string, completed: boolean, actor: SessionUser | null) {
  try {
    await completeWorkshopTask(bikeId, taskId, completed, actor);
  } catch (error) {
    if (error instanceof WorkshopError) throw new BikeAdminError(error.message);
    throw error;
  }
}

// --- Specs / costs -------------------------------------------------------------------

export interface BikeUpdateInput {
  [key: string]: unknown;
}

export async function updateBike(
  bikeId: string,
  input: Record<string, unknown>,
  actor: SessionUser | null,
  opts?: { priceChanged?: boolean; newPriceCents?: number | null },
) {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");

  const data: Record<string, unknown> = { ...input };
  const protectedFields = new Set([
    "status",
    "soldAt",
    "soldOrderNumber",
    "warrantyStart",
    "warrantyEnd",
    "realisedSalePriceCents",
  ]);
  const attemptedProtectedField = Object.keys(data).find((field) => protectedFields.has(field));
  if (attemptedProtectedField) {
    throw new BikeAdminError(`${attemptedProtectedField} wordt uitsluitend door de centrale lifecycle beheerd.`);
  }

  // Price history (spec 47): track asking-price changes without overwriting history.
  const newPrice = typeof data.priceCents === "number" ? data.priceCents : undefined;
  if (newPrice != null && (!Number.isSafeInteger(newPrice) || newPrice < 0)) {
    throw new BikeAdminError("De vraagprijs moet een niet-negatief geheel bedrag in centen zijn.");
  }
  if (newPrice != null && newPrice !== bike.priceCents) {
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.bike.updateMany({
        where: { id: bikeId, priceCents: bike.priceCents },
        data: { ...data, previousPriceCents: bike.priceCents },
      });
      if (changed.count !== 1) {
        throw new BikeAdminError("De vraagprijs wijzigde gelijktijdig; ververs het fietsdossier en probeer opnieuw.");
      }
      await tx.priceHistoryEntry.create({
        data: {
          bikeId,
          oldPriceCents: bike.priceCents,
          newPriceCents: newPrice,
          changedBy: actor?.id ?? null,
        },
      });
      return tx.bike.findUnique({ where: { id: bike.id } });
    });
    await audit(
      "bike.updated",
      "Bike",
      bike.id,
      { fields: Object.keys(input), priceChanged: true, oldPriceCents: bike.priceCents, newPriceCents: newPrice },
      actor,
    );
    if (!updated) throw new BikeAdminError("Fiets niet gevonden.");
    return updated as Bike;
  }

  const updated = (await prisma.bike.update({ where: { id: bike.id }, data })) as Bike;
  await audit(
    "bike.updated",
    "Bike",
    bike.id,
    { fields: Object.keys(input), priceChanged: newPrice != null && newPrice !== bike.priceCents },
    actor,
  );
  return updated;
}

/**
 * Copy reusable TECHNICAL specifications from an existing bike (spec 8).
 *
 * NEVER copies: costs, photos, description, status, battery state, lifecycle.
 * The new bike remains a fully independent UNIQUE_BIKE record.
 */
export const COPYABLE_SPEC_FIELDS = [
  "brand",
  "model",
  "bikeType",
  "isElectric",
  "frameStyle",
  "genderStyle",
  "colour",
  "frameSizeCm",
  "wheelSizeInches",
  "gears",
  "assistanceLevels",
  "brakeInfo",
  "drivetrainInfo",
  "motorManufacturer",
  "motorModel",
  "motorPosition",
  "motorDescription",
  "nominalVoltage",
  "walkAssist",
  "electricalNotes",
  "batteryType",
  "batteryVoltage",
  "batteryAh",
  "batteryWh",
  "features",
] as const;

export async function copySpecsFrom(sourceBikeId: string, targetBikeId: string, actor: SessionUser | null) {
  const source = await prisma.bike.findUnique({ where: { id: sourceBikeId } });
  if (!source) throw new BikeAdminError("Bron-fiets niet gevonden.");
  const target = await prisma.bike.findUnique({ where: { id: targetBikeId } });
  if (!target) throw new BikeAdminError("Nieuwe fiets niet gevonden.");

  const data: Record<string, unknown> = {};
  for (const f of COPYABLE_SPEC_FIELDS) {
    const v = (source as unknown as Record<string, unknown>)[f];
    if (v !== null && v !== undefined) data[f] = v;
  }
  await prisma.bike.update({ where: { id: target.id }, data });
  await audit("bike.specs_copied", "Bike", target.id, { sourceBikeId, sourceInventory: source.inventoryCode }, actor);
}

// --- Description regeneration -----------------------------------------------------------

export async function regenerateDescription(bikeId: string, actor: SessionUser | null): Promise<string> {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  const ctx = await defaultDescriptionContext();
  const description = generateBikeDescription(bike, ctx);
  await prisma.bike.update({ where: { id: bike.id }, data: { description, descriptionTouched: false } });
  await audit("bike.description_regenerated", "Bike", bike.id, null, actor);
  return description;
}

export async function saveDescription(bikeId: string, description: string, actor: SessionUser | null) {
  await prisma.bike.update({
    where: { id: bikeId },
    data: { description: description.trim(), descriptionTouched: true },
  });
  await audit("bike.description_saved", "Bike", bikeId, null, actor);
}

// --- Inventory age (spec 47) ---------------------------------------------------------------

export function daysInStock(bike: { createdAt: Date; soldAt: Date | null; publishedAt: Date | null }): number {
  const end = bike.soldAt ?? new Date();
  const start = bike.publishedAt ?? bike.createdAt;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

// --- Admin QR label (spec 47) — links to the authenticated admin record ----------------

export function adminBikeUrl(bikeId: string): string {
  return `${env.baseUrl}/admin/fietsen/${bikeId}`;
}

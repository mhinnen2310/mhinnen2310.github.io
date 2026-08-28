import { prisma } from "./prisma";
import type { Bike, BikeStatus } from "@prisma/client";
import { canTransition } from "./bikes";
import { generateBikeDescription, defaultDescriptionContext } from "./descriptions";
import { getWarrantyScopes, addMonths } from "./warranty";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { env } from "./env";

/**
 * Admin operations on unique bikes (specs 7, 8, 46, 47).
 *
 * Every state change validates the lifecycle transition table and records
 * an audit entry. Financial/order-integrity actions (mark sold, reserve)
 * require the UI to confirm; here we only enforce the invariants.
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
  bike: Bike & { images: { id: string }[] },
): Promise<PublishCheck> {
  const missing: string[] = [];
  if (!bike.priceCents || bike.priceCents <= 0) missing.push("Vraagprijs invullen");
  if (!bike.images || bike.images.length === 0) missing.push("Minimaal 1 foto toevoegen");
  if (!bike.description?.trim() && !bike.descriptionTouched) missing.push("Beschrijving genereren of invoeren");
  if (!bike.title?.trim()) missing.push("Titel controleren");
  return { ready: missing.length === 0, missing };
}

export async function setBikeStatus(
  bikeId: string,
  to: BikeStatus,
  actor: SessionUser | null,
  opts?: { salePriceCents?: number | null; note?: string | null },
): Promise<Bike> {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId }, include: { images: true } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  if (bike.status === to) return bike;
  if (!canTransition(bike.status, to)) {
    throw new BikeAdminError(`Statuswijziging ${bike.status} -> ${to} is niet toegestaan.`);
  }

  const data: Record<string, unknown> = { status: to };

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

  if (to === "SOLD") {
    data.soldAt = new Date();
    const salePrice = opts?.salePriceCents ?? bike.priceCents;
    if (salePrice == null || salePrice <= 0) {
      throw new BikeAdminError("Voor verkochte fiets is een verkoopprijs verplicht.");
    }
    data.realisedSalePriceCents = salePrice;
    const scopes = await getWarrantyScopes();
    if (scopes.length) {
      const start = new Date();
      const end = addMonths(start, Math.max(...scopes.map((s) => s.months)));
      data.warrantyStart = start;
      data.warrantyEnd = end;
    }
  }

  if (to === "AVAILABLE" && bike.status === "RESERVED") {
    // release any active reservation of this bike
    await prisma.reservation.updateMany({
      where: { bikeId: bike.id, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
  }

  const updated = await prisma.bike.update({ where: { id: bike.id }, data });
  await audit(
    `bike.status:${bike.status}->${to}`,
    "Bike",
    bike.id,
    { inventoryCode: bike.inventoryCode, note: opts?.note ?? null, salePriceCents: opts?.salePriceCents ?? null },
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
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  if (bike.status !== "AVAILABLE" && bike.status !== "READY") {
    throw new BikeAdminError("Alleen een beschikbare fiets kan gereserveerd worden.");
  }
  const ttl = input.expiresInMinutes ?? 24 * 7; // manual holds: 7 days max
  const updated = await prisma.bike.updateMany({
    where: { id: bike.id, status: { in: ["AVAILABLE", "READY"] } },
    data: { status: "RESERVED" },
  });
  if (updated.count !== 1) throw new BikeAdminError("Deze fiets kan niet gereserveerd worden (status wijzigde gelijktijdig).");
  await prisma.reservation.create({
    data: {
      bikeId: bike.id,
      source: input.source,
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail ?? null,
      customerPhone: input.customerPhone ?? null,
      note: input.note ?? null,
      expiresAt: new Date(Date.now() + ttl * 60_000),
      status: "ACTIVE",
    },
  });
  await audit("bike.reserved", "Bike", bike.id, { source: input.source }, actor);
}

export async function unreserveBike(bikeId: string, actor: SessionUser | null, to: "AVAILABLE" | "READY" = "AVAILABLE"): Promise<void> {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  if (bike.status !== "RESERVED") throw new BikeAdminError("Deze fiets is niet gereserveerd.");
  await prisma.bike.updateMany({
    where: { id: bike.id, status: "RESERVED" },
    data: { status: to },
  });
  await prisma.reservation.updateMany({
    where: { bikeId: bike.id, status: "ACTIVE", orderId: null },
    data: { status: "RELEASED" },
  });
  await audit(`bike.unreserved:${to}`, "Bike", bike.id, null, actor);
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
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new BikeAdminError("Fiets niet gevonden.");
  const partCost = input.partCostCents ?? 0;
  await prisma.serviceTask.create({
    data: {
      bikeId,
      description: input.description,
      partCostCents: partCost || null,
      quantity: input.quantity ?? 1,
      doneDate: input.doneDate ?? null,
      internalNotes: input.internalNotes ?? null,
      completed: input.completed ?? false,
    },
  });
  if (partCost > 0) {
    await prisma.bike.update({
      where: { id: bike.id },
      data: { partsCostCents: { increment: partCost * (input.quantity ?? 1) } },
    });
  }
  await audit("bike.service_task_added", "Bike", bike.id, { description: input.description }, actor);
}

export async function setTaskCompleted(bikeId: string, taskId: string, completed: boolean) {
  const task = await prisma.serviceTask.findUnique({ where: { id: taskId } });
  if (!task || task.bikeId !== bikeId) throw new BikeAdminError("Werkplaatsactiviteit niet gevonden.");
  await prisma.serviceTask.update({
    where: { id: taskId },
    data: { completed, doneDate: completed ? new Date() : null },
  });
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

  // Price history (spec 47): track asking-price changes without overwriting history.
  const newPrice = typeof data.priceCents === "number" ? data.priceCents : undefined;
  if (newPrice != null && newPrice !== bike.priceCents) {
    await prisma.priceHistoryEntry.create({
      data: {
        bikeId,
        oldPriceCents: bike.priceCents,
        newPriceCents: newPrice,
        changedBy: actor?.id ?? null,
      },
    });
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
  "wheelSizeCm",
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

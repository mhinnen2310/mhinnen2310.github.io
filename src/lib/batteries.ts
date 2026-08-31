import type { BatteryStatus, Prisma } from "@prisma/client";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { nextBatteryAssetCodeInTx } from "./numbers";
import { prisma } from "./prisma";

export class BatteryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatteryError";
  }
}

const BATTERY_STATUSES = ["INTAKE", "WORKSHOP", "READY", "STOCK", "ASSIGNED", "RETIRED"] as const;

function own(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function text(body: Record<string, unknown>, key: string, label: string, max: number): string | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new BatteryError(`${label} is ongeldig.`);
  const result = value.trim();
  if (result.length > max) throw new BatteryError(`${label} is te lang.`);
  return result || null;
}

function integer(body: Record<string, unknown>, key: string, label: string, min: number, max: number): number | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new BatteryError(`${label} is ongeldig.`);
  return parsed;
}

function decimal(body: Record<string, unknown>, key: string, label: string, min: number, max: number): string | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || Math.round(parsed * 100) !== parsed * 100) {
    throw new BatteryError(`${label} is ongeldig.`);
  }
  return parsed.toFixed(2);
}

function boolean(body: Record<string, unknown>, key: string, label: string): boolean | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "boolean") throw new BatteryError(`${label} is ongeldig.`);
  return value;
}

function date(body: Record<string, unknown>, key: string, label: string): Date | null | undefined {
  if (!own(body, key)) return undefined;
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new BatteryError(`${label} is ongeldig.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BatteryError(`${label} is ongeldig.`);
  return parsed;
}

function status(body: Record<string, unknown>): BatteryStatus | undefined {
  if (!own(body, "status")) return undefined;
  const value = body.status;
  if (typeof value !== "string" || !BATTERY_STATUSES.includes(value as (typeof BATTERY_STATUSES)[number])) {
    throw new BatteryError("De accustatus is ongeldig.");
  }
  return value as BatteryStatus;
}

export function parseBatteryInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const texts: Array<[string, string, number]> = [
    ["serialNumber", "Serienummer", 160], ["type", "Accutype", 100], ["manufacturer", "Fabrikant", 100], ["model", "Model", 120],
    ["testMethod", "Testmethode", 500], ["condition", "Accustaat", 500], ["notes", "Notities", 4_000],
  ];
  for (const [key, label, max] of texts) {
    const value = text(body, key, label, max);
    if (value !== undefined) data[key] = value;
  }
  const integers: Array<[string, string, number, number]> = [
    ["voltage", "Voltage", 0, 100], ["nominalWh", "Nominale Wh", 0, 3_000], ["measuredWh", "Gemeten Wh", 0, 3_000],
    ["cycleCount", "Cycli", 0, 100_000], ["rangeMinKm", "Minimale actieradius", 0, 500], ["rangeMaxKm", "Maximale actieradius", 0, 500],
    ["warrantyMonths", "Garantie", 0, 120], ["acquisitionCostCents", "Inkoopprijs", 0, 100_000_000], ["partsCostCents", "Onderdelenkosten", 0, 100_000_000],
    ["repairCostCents", "Reparatiekosten", 0, 100_000_000], ["labourMinutes", "Arbeidstijd", 0, 100_000],
  ];
  for (const [key, label, min, max] of integers) {
    const value = integer(body, key, label, min, max);
    if (value !== undefined) data[key] = value;
  }
  for (const [key, label, min, max] of [["nominalAh", "Nominale Ah", 0, 999.99], ["measuredAh", "Gemeten Ah", 0, 999.99], ["sohPercent", "SOH", 0, 100]] as const) {
    const value = decimal(body, key, label, min, max);
    if (value !== undefined) data[key] = value;
  }
  for (const [key, label] of [["reconditioned", "Revisie"] as const]) {
    const value = boolean(body, key, label);
    if (value !== undefined) data[key] = value;
  }
  for (const [key, label] of [["testDate", "Testdatum"], ["revisionDate", "Revisiedatum"]] as const) {
    const value = date(body, key, label);
    if (value !== undefined) data[key] = value;
  }
  const nextStatus = status(body);
  if (nextStatus !== undefined) data.status = nextStatus;
  return data;
}

type BatteryWithLegacy = {
  id: string; manufacturer: string | null; model: string | null; type: string | null; voltage: number | null;
  nominalAh: unknown; nominalWh: number | null; measuredAh: unknown; measuredWh: number | null; sohPercent: unknown;
  testDate: Date | null; testMethod: string | null; cycleCount: number | null; condition: string | null; reconditioned: boolean | null;
  revisionDate: Date | null; rangeMinKm: number | null; rangeMaxKm: number | null; serialNumber: string | null; warrantyMonths: number | null;
};

/** Keep old Bike battery columns as a public/sale snapshot while the asset is assigned. */
async function syncLegacyBikeFieldsTx(tx: Pick<Prisma.TransactionClient, "bike">, bikeId: string, battery: BatteryWithLegacy) {
  await tx.bike.update({
    where: { id: bikeId },
    data: {
      batteryType: battery.type,
      batteryManufacturer: battery.manufacturer,
      batteryModel: battery.model,
      batteryVoltage: battery.voltage,
      batteryAh: battery.nominalAh as Prisma.Decimal | null,
      batteryWh: battery.nominalWh,
      batteryMeasuredAh: battery.measuredAh as Prisma.Decimal | null,
      batteryMeasuredWh: battery.measuredWh,
      batterySohPercent: battery.sohPercent as Prisma.Decimal | null,
      batteryTestDate: battery.testDate,
      batteryTestMethod: battery.testMethod,
      batteryCycleCount: battery.cycleCount,
      batteryCondition: battery.condition,
      batteryReconditioned: battery.reconditioned,
      batteryRevisionDate: battery.revisionDate,
      rangeMinKm: battery.rangeMinKm,
      rangeMaxKm: battery.rangeMaxKm,
      batterySerialRef: battery.serialNumber,
      batteryWarrantyMonths: battery.warrantyMonths,
    },
  });
}

export async function createBatteryAsset(body: Record<string, unknown>, actor: SessionUser) {
  const data = parseBatteryInput(body);
  if (data.status === "ASSIGNED") throw new BatteryError("Koppel een nieuwe accu eerst via het accudossier aan een fiets.");
  const created = await prisma.$transaction(async (tx) => {
    const assetCode = await nextBatteryAssetCodeInTx(tx);
    return tx.battery.create({ data: { ...(data as Prisma.BatteryUncheckedCreateInput), assetCode }, select: { id: true, assetCode: true, status: true } });
  });
  await audit("battery.created", "Battery", created.id, { assetCode: created.assetCode }, actor);
  return created;
}

export async function updateBatteryAsset(id: string, body: Record<string, unknown>, actor: SessionUser) {
  const data = parseBatteryInput(body);
  const current = await prisma.battery.findUnique({ where: { id }, include: { currentBike: { select: { id: true } } } });
  if (!current) throw new BatteryError("Accu niet gevonden.");
  if (data.status === "ASSIGNED" && !current.currentBike) throw new BatteryError("Een accu kan alleen ASSIGNED zijn als hij aan een fiets gekoppeld is.");
  if (data.status && current.currentBike && data.status !== "ASSIGNED") throw new BatteryError("Koppel de accu eerst los voordat je de status wijzigt.");
  const updated = await prisma.battery.update({ where: { id }, data });
  if (current.currentBike) {
    const fresh = await prisma.battery.findUnique({ where: { id }, select: {
      id: true, manufacturer: true, model: true, type: true, voltage: true, nominalAh: true, nominalWh: true, measuredAh: true, measuredWh: true,
      sohPercent: true, testDate: true, testMethod: true, cycleCount: true, condition: true, reconditioned: true, revisionDate: true,
      rangeMinKm: true, rangeMaxKm: true, serialNumber: true, warrantyMonths: true,
    } });
    if (fresh) await syncLegacyBikeFieldsTx(prisma, current.currentBike.id, fresh as BatteryWithLegacy);
  }
  await audit("battery.updated", "Battery", id, { fields: Object.keys(data) }, actor);
  return updated;
}

export async function assignBatteryToBike(batteryId: string, bikeId: string, actor: SessionUser, note?: string | null) {
  await prisma.$transaction(async (tx) => {
    const battery = await tx.battery.findUnique({ where: { id: batteryId }, include: { currentBike: { select: { id: true, currentBatteryId: true } } } });
    const bike = await tx.bike.findUnique({ where: { id: bikeId }, select: { id: true, currentBatteryId: true } });
    if (!battery) throw new BatteryError("Accu niet gevonden.");
    if (!bike) throw new BatteryError("Fiets niet gevonden.");
    if (battery.status === "RETIRED") throw new BatteryError("Een ingetrokken accu kan niet worden gekoppeld.");
    if (battery.currentBike?.id === bike.id) return;

    const now = new Date();
    if (battery.currentBike) {
      await tx.bike.updateMany({ where: { id: battery.currentBike.id, currentBatteryId: batteryId }, data: { currentBatteryId: null } });
      await tx.batteryAssignment.updateMany({ where: { batteryId, bikeId: battery.currentBike.id, unassignedAt: null }, data: { unassignedAt: now } });
    }
    if (bike.currentBatteryId && bike.currentBatteryId !== batteryId) {
      await tx.batteryAssignment.updateMany({ where: { batteryId: bike.currentBatteryId, bikeId, unassignedAt: null }, data: { unassignedAt: now } });
      await tx.battery.update({ where: { id: bike.currentBatteryId }, data: { status: "STOCK" } });
    }
    const attached = await tx.bike.update({ where: { id: bikeId }, data: { currentBatteryId: batteryId } });
    await tx.battery.update({ where: { id: batteryId }, data: { status: "ASSIGNED" } });
    await tx.batteryAssignment.create({ data: { batteryId, bikeId, note: note?.trim() || null, changedById: actor.id } });
    const fresh = await tx.battery.findUnique({ where: { id: batteryId }, select: {
      id: true, manufacturer: true, model: true, type: true, voltage: true, nominalAh: true, nominalWh: true, measuredAh: true, measuredWh: true,
      sohPercent: true, testDate: true, testMethod: true, cycleCount: true, condition: true, reconditioned: true, revisionDate: true,
      rangeMinKm: true, rangeMaxKm: true, serialNumber: true, warrantyMonths: true,
    } });
    if (fresh) await syncLegacyBikeFieldsTx(tx, attached.id, fresh as BatteryWithLegacy);
  });
  await audit("battery.assigned", "Battery", batteryId, { bikeId, note: note ?? null }, actor);
}

export async function unassignBatteryFromBike(batteryId: string, actor: SessionUser, note?: string | null) {
  await prisma.$transaction(async (tx) => {
    const bike = await tx.bike.findFirst({ where: { currentBatteryId: batteryId }, select: { id: true } });
    if (!bike) throw new BatteryError("Deze accu is niet aan een fiets gekoppeld.");
    const now = new Date();
    await tx.bike.update({ where: { id: bike.id }, data: { currentBatteryId: null } });
    await tx.battery.update({ where: { id: batteryId }, data: { status: "STOCK" } });
    await tx.batteryAssignment.updateMany({ where: { batteryId, bikeId: bike.id, unassignedAt: null }, data: { unassignedAt: now, note: note?.trim() || undefined } });
  });
  await audit("battery.unassigned", "Battery", batteryId, { note: note ?? null }, actor);
}

export async function ensureLegacyBatteryForBike(bikeId: string, actor?: SessionUser | null) {
  return prisma.$transaction(async (tx) => {
    const bike = await tx.bike.findUnique({ where: { id: bikeId }, select: {
      id: true, currentBatteryId: true, batteryType: true, batteryManufacturer: true, batteryModel: true, batteryVoltage: true, batteryAh: true,
      batteryWh: true, batteryMeasuredAh: true, batteryMeasuredWh: true, batterySohPercent: true, batteryTestDate: true, batteryTestMethod: true,
      batteryCycleCount: true, batteryCondition: true, batteryReconditioned: true, batteryRevisionDate: true, rangeMinKm: true, rangeMaxKm: true,
      batterySerialRef: true, batteryWarrantyMonths: true,
    } });
    if (!bike) throw new BatteryError("Fiets niet gevonden.");
    if (bike.currentBatteryId) return bike.currentBatteryId;
    const hasLegacy = [bike.batteryType, bike.batteryManufacturer, bike.batteryModel, bike.batterySerialRef, bike.batteryWh].some(Boolean);
    if (!hasLegacy) return null;
    const assetCode = await nextBatteryAssetCodeInTx(tx);
    const battery = await tx.battery.create({ data: {
      assetCode, type: bike.batteryType, manufacturer: bike.batteryManufacturer, model: bike.batteryModel, voltage: bike.batteryVoltage,
      nominalAh: bike.batteryAh, nominalWh: bike.batteryWh, measuredAh: bike.batteryMeasuredAh, measuredWh: bike.batteryMeasuredWh,
      sohPercent: bike.batterySohPercent, testDate: bike.batteryTestDate, testMethod: bike.batteryTestMethod, cycleCount: bike.batteryCycleCount,
      condition: bike.batteryCondition, reconditioned: bike.batteryReconditioned, revisionDate: bike.batteryRevisionDate, rangeMinKm: bike.rangeMinKm,
      rangeMaxKm: bike.rangeMaxKm, serialNumber: bike.batterySerialRef, warrantyMonths: bike.batteryWarrantyMonths, status: "ASSIGNED",
    }, select: { id: true } });
    await tx.bike.update({ where: { id: bike.id }, data: { currentBatteryId: battery.id } });
    await tx.batteryAssignment.create({ data: { batteryId: battery.id, bikeId: bike.id, note: "Automatisch overgenomen uit bestaande fietsgegevens.", changedById: actor?.id ?? null } });
    return battery.id;
  });
}

export async function addBatteryRepair(batteryId: string, data: { description: string; partName?: string | null; partCostCents?: number | null; quantity?: number; labourMinutes?: number | null; labourCostCents?: number | null; internalNotes?: string | null; completed?: boolean; doneDate?: Date | null }, actor: SessionUser) {
  if (!data.description.trim()) throw new BatteryError("Omschrijving is verplicht.");
  const completed = data.completed === true;
  const repair = await prisma.batteryRepair.create({ data: {
    batteryId, description: data.description.trim(), partName: data.partName?.trim() || null, partCostCents: data.partCostCents ?? null,
    quantity: data.quantity ?? 1, labourMinutes: data.labourMinutes ?? null, labourCostCents: data.labourCostCents ?? null,
    internalNotes: data.internalNotes?.trim() || null, completed, doneDate: completed ? (data.doneDate ?? new Date()) : null, completedById: completed ? actor.id : null,
  } });
  await audit("battery.repair_added", "Battery", batteryId, { repairId: repair.id, completed }, actor);
  return repair;
}

export async function updateBatteryRepair(batteryId: string, repairId: string, data: Partial<Parameters<typeof addBatteryRepair>[1]>, actor: SessionUser) {
  const current = await prisma.batteryRepair.findFirst({ where: { id: repairId, batteryId } });
  if (!current) throw new BatteryError("Accureparatie niet gevonden.");
  const completed = data.completed ?? current.completed;
  const repair = await prisma.batteryRepair.update({ where: { id: current.id }, data: {
    ...(data.description !== undefined ? { description: data.description.trim() } : {}), ...(data.partName !== undefined ? { partName: data.partName?.trim() || null } : {}),
    ...(data.partCostCents !== undefined ? { partCostCents: data.partCostCents } : {}), ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
    ...(data.labourMinutes !== undefined ? { labourMinutes: data.labourMinutes } : {}), ...(data.labourCostCents !== undefined ? { labourCostCents: data.labourCostCents } : {}),
    ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes?.trim() || null } : {}), completed,
    doneDate: completed ? (data.doneDate ?? current.doneDate ?? new Date()) : null, completedById: completed ? actor.id : null,
  } });
  await audit("battery.repair_updated", "Battery", batteryId, { repairId }, actor);
  return repair;
}

export async function deleteBatteryRepair(batteryId: string, repairId: string, actor: SessionUser) {
  const result = await prisma.batteryRepair.deleteMany({ where: { id: repairId, batteryId } });
  if (result.count !== 1) throw new BatteryError("Accureparatie niet gevonden.");
  await audit("battery.repair_deleted", "Battery", batteryId, { repairId }, actor);
}

export { BATTERY_STATUSES };

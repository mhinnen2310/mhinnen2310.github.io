import type { InspectionResult, Prisma, ServiceTask } from "@prisma/client";
import type { SessionUser } from "./auth";
import { audit } from "./audit";
import { prisma } from "./prisma";

export class WorkshopError extends Error {
  constructor(message: string) { super(message); this.name = "WorkshopError"; }
}

export const INSPECTION_CHECKLIST = [
  ["front_brake", "Voorrem"], ["rear_brake", "Achterrem"], ["tyres", "Banden"], ["wheels", "Wielen"],
  ["headset", "Balhoofd"], ["bearings", "Lagers"], ["drivetrain", "Aandrijving"], ["gears", "Versnellingen"],
  ["lights", "Verlichting"], ["motor", "Motor"], ["display", "Display"], ["battery", "Accu"], ["charger", "Lader"],
] as const;

export type InspectionKey = (typeof INSPECTION_CHECKLIST)[number][0];
const inspectionLabels = new Map<string, string>(INSPECTION_CHECKLIST);

export function inspectionLabel(key: string): string { return inspectionLabels.get(key) ?? key; }
export function isInspectionKey(value: string): value is InspectionKey { return inspectionLabels.has(value); }

type Tx = Prisma.TransactionClient;

async function ensureChecklistTx(tx: Tx, bikeId: string) {
  await tx.serviceTask.createMany({
    data: INSPECTION_CHECKLIST.map(([checklistKey, description]) => ({ bikeId, checklistKey, description })),
    skipDuplicates: true,
  });
}

/** Ensure every bike has exactly one row for each required inspection item. */
export async function ensureInspectionChecklist(bikeId: string) {
  await prisma.$transaction(async (tx) => {
    const bike = await tx.bike.findUnique({ where: { id: bikeId }, select: { id: true } });
    if (!bike) throw new WorkshopError("Fiets niet gevonden.");
    await ensureChecklistTx(tx, bikeId);
  });
}

export interface Readiness { ready: boolean; missing: string[]; }

export function ensureBikeIntake(bikeId: string) {
  return prisma.bikeIntake.upsert({ where: { bikeId }, create: { bikeId }, update: {} });
}

/** Intake readiness combines canonical Bike acquisition data and BikeIntake controls. */
export async function getIntakeReadiness(bikeId: string): Promise<Readiness> {
  const bike = await prisma.bike.findUnique({
    where: { id: bikeId },
    select: { frameSerialRef: true, isElectric: true, acquisitionSource: true, acquisitionDate: true, acquisitionCostCents: true, intakeRecord: true },
  });
  if (!bike) throw new WorkshopError("Fiets niet gevonden.");
  const intake = bike.intakeRecord;
  const missing: string[] = [];
  if (!bike.frameSerialRef?.trim() || !intake?.frameSerialPresent) missing.push("Framenummer controleren");
  if (!intake?.keysPresent) missing.push("Sleutels registreren");
  if (!intake?.chargerPresent) missing.push("Lader registreren");
  if (bike.isElectric && !intake?.batteryPresent) missing.push("Accu registreren");
  if (!intake?.defectsAssessed) missing.push("Bekende gebreken beoordelen");
  if (!bike.acquisitionSource?.trim()) missing.push("Inkoopbron invullen");
  if (!bike.acquisitionDate) missing.push("Inkoopdatum invullen");
  if (bike.acquisitionCostCents == null) missing.push("Inkoopprijs invullen");
  if (!intake?.theftCheckCompleted) missing.push("Diefstalcontrole uitvoeren");
  if (!intake?.theftCheckDate) missing.push("Datum diefstalcontrole invullen");
  if (!intake?.theftCheckResult?.trim()) missing.push("Resultaat diefstalcontrole invullen");
  return { ready: missing.length === 0, missing };
}

export async function getWorkshopReadiness(bikeId: string): Promise<Readiness> {
  await ensureInspectionChecklist(bikeId);
  const tasks = await prisma.serviceTask.findMany({ where: { bikeId, checklistKey: { not: null } }, select: { checklistKey: true, inspectionResult: true } });
  const byKey = new Map(tasks.map((task) => [task.checklistKey, task.inspectionResult]));
  const missing = INSPECTION_CHECKLIST.filter(([key]) => !byKey.get(key)).map(([, label]) => label);
  return { ready: missing.length === 0, missing };
}

export interface IntakeInput {
  frameSerialPresent: boolean;
  keysPresent: boolean;
  chargerPresent: boolean;
  batteryPresent: boolean;
  defectsAssessed: boolean;
  knownDefects?: string | null;
  theftCheckCompleted: boolean;
  theftCheckDate?: Date | null;
  theftCheckResult?: string | null;
}

export async function saveBikeIntake(bikeId: string, input: IntakeInput, actor: SessionUser | null) {
  const intake = await prisma.bikeIntake.upsert({ where: { bikeId }, create: { bikeId, ...input }, update: input });
  await audit("bike.intake_saved", "Bike", bikeId, { theftCheckCompleted: input.theftCheckCompleted, defectsAssessed: input.defectsAssessed }, actor);
  return intake;
}

export interface WorkshopTaskInput {
  description: string;
  checklistKey?: InspectionKey | null;
  inspectionResult?: InspectionResult | null;
  partName?: string | null;
  partCostCents?: number | null;
  quantity?: number;
  labourMinutes?: number | null;
  labourCostCents?: number | null;
  internalNotes?: string | null;
  doneDate?: Date | null;
  completed?: boolean;
}

export function workshopTaskCostDelta(task: { partCostCents: number | null; quantity: number; labourMinutes: number | null; labourCostCents: number | null }) {
  return {
    partsCents: (task.partCostCents ?? 0) * task.quantity,
    labourCents: task.labourCostCents ?? 0,
    labourMinutes: task.labourMinutes ?? 0,
  };
}

async function applyTaskCostsTx(tx: Tx, bikeId: string, task: { id: string; partCostCents: number | null; quantity: number; labourMinutes: number | null; labourCostCents: number | null; costAppliedAt: Date | null }) {
  if (task.costAppliedAt) return false;
  const claimed = await tx.serviceTask.updateMany({ where: { id: task.id, costAppliedAt: null }, data: { costAppliedAt: new Date() } });
  if (claimed.count !== 1) return false;
  const costs = workshopTaskCostDelta(task);
  await tx.bike.update({
    where: { id: bikeId },
    data: {
      partsCostCents: { increment: costs.partsCents },
      repairCostCents: { increment: costs.labourCents },
      ...(costs.labourMinutes > 0 ? { labourMinutes: { increment: costs.labourMinutes } } : {}),
    },
  });
  return true;
}

/** Reopening a completed task must also remove its once-booked costs. */
async function reverseTaskCostsTx(tx: Tx, bikeId: string, task: { id: string; partCostCents: number | null; quantity: number; labourMinutes: number | null; labourCostCents: number | null; costAppliedAt: Date | null }) {
  if (!task.costAppliedAt) return false;
  const claimed = await tx.serviceTask.updateMany({ where: { id: task.id, costAppliedAt: { not: null } }, data: { costAppliedAt: null } });
  if (claimed.count !== 1) return false;
  const costs = workshopTaskCostDelta(task);
  await tx.bike.update({
    where: { id: bikeId },
    data: {
      partsCostCents: { decrement: costs.partsCents },
      repairCostCents: { decrement: costs.labourCents },
      ...(costs.labourMinutes > 0 ? { labourMinutes: { decrement: costs.labourMinutes } } : {}),
    },
  });
  return true;
}

export async function addWorkshopTask(bikeId: string, input: WorkshopTaskInput, actor: SessionUser | null) {
  const quantity = input.quantity ?? 1;
  const completes = input.completed === true || input.inspectionResult != null;
  const created = await prisma.$transaction(async (tx) => {
    const bike = await tx.bike.findUnique({ where: { id: bikeId }, select: { id: true } });
    if (!bike) throw new WorkshopError("Fiets niet gevonden.");
    if (input.checklistKey) await ensureChecklistTx(tx, bikeId);
    const taskData = {
      description: input.checklistKey ? inspectionLabel(input.checklistKey) : input.description,
      checklistKey: input.checklistKey ?? null, inspectionResult: input.inspectionResult ?? null,
      partName: input.partName ?? null, partCostCents: input.partCostCents ?? null, quantity,
      labourMinutes: input.labourMinutes ?? null, labourCostCents: input.labourCostCents ?? null,
      internalNotes: input.internalNotes ?? null, completed: completes, doneDate: completes ? (input.doneDate ?? new Date()) : null,
      completedById: completes ? (actor?.id ?? null) : null,
    };
    let task: ServiceTask;
    if (input.checklistKey) {
      const where = { bikeId_checklistKey: { bikeId, checklistKey: input.checklistKey } };
      const existing = await tx.serviceTask.findUniqueOrThrow({ where });
      // Reconcile the exact values that were previously booked before
      // overwriting a completed checklist row. The new values are applied
      // again below when this update keeps the task completed.
      if (existing.costAppliedAt) await reverseTaskCostsTx(tx, bikeId, existing);
      task = await tx.serviceTask.update({ where, data: taskData });
    } else {
      task = await tx.serviceTask.create({ data: { bikeId, ...taskData } });
    }
    if (completes) await applyTaskCostsTx(tx, bikeId, task);
    return task;
  });
  await audit("bike.service_task_added", "Bike", bikeId, { taskId: created.id, checklistKey: input.checklistKey ?? null, quantity }, actor);
  return created;
}

export async function completeWorkshopTask(bikeId: string, taskId: string, completed: boolean, actor: SessionUser | null, inspectionResult?: InspectionResult | null) {
  await prisma.$transaction(async (tx) => {
    const task = await tx.serviceTask.findFirst({ where: { id: taskId, bikeId } });
    if (!task) throw new WorkshopError("Werkplaatsactiviteit niet gevonden.");
    const shouldComplete = completed || inspectionResult != null;
    const changed = await tx.serviceTask.updateMany({
      where: { id: task.id, bikeId, completed: task.completed },
      data: {
        completed: shouldComplete, inspectionResult: shouldComplete ? (inspectionResult ?? task.inspectionResult) : null,
        doneDate: shouldComplete ? new Date() : null, completedById: shouldComplete ? (actor?.id ?? null) : null,
      },
    });
    if (changed.count !== 1) throw new WorkshopError("De werkplaatsregel wijzigde gelijktijdig; ververs het dossier.");
    if (shouldComplete) await applyTaskCostsTx(tx, bikeId, task);
    else await reverseTaskCostsTx(tx, bikeId, task);
  });
  await audit("bike.service_task_status_changed", "Bike", bikeId, { taskId, completed, inspectionResult: inspectionResult ?? null }, actor);
}

/** Correct an ordinary workshop row while reconciling every previously booked cost. */
export async function editWorkshopTask(bikeId: string, taskId: string, input: WorkshopTaskInput, actor: SessionUser | null) {
  const quantity = input.quantity ?? 1;
  const completed = input.completed === true || input.inspectionResult != null;
  const task = await prisma.$transaction(async (tx) => {
    const existing = await tx.serviceTask.findFirst({ where: { id: taskId, bikeId } });
    if (!existing) throw new WorkshopError("Werkplaatsactiviteit niet gevonden.");
    if (existing.checklistKey) throw new WorkshopError("Een inspectiepunt wordt via de checklist bijgewerkt.");
    if (existing.costAppliedAt) await reverseTaskCostsTx(tx, bikeId, existing);
    const updated = await tx.serviceTask.update({ where: { id: existing.id }, data: {
      description: input.description, partName: input.partName ?? null, partCostCents: input.partCostCents ?? null, quantity,
      labourMinutes: input.labourMinutes ?? null, labourCostCents: input.labourCostCents ?? null, internalNotes: input.internalNotes ?? null,
      completed, inspectionResult: input.inspectionResult ?? null, doneDate: completed ? (input.doneDate ?? new Date()) : null,
      completedById: completed ? (actor?.id ?? null) : null,
    } });
    if (completed) await applyTaskCostsTx(tx, bikeId, updated);
    return updated;
  });
  await audit("bike.service_task_edited", "Bike", bikeId, { taskId }, actor);
  return task;
}

/** Checklist rows are part of the inspection template; ad-hoc work may be removed. */
export async function deleteWorkshopTask(bikeId: string, taskId: string, actor: SessionUser | null) {
  await prisma.$transaction(async (tx) => {
    const task = await tx.serviceTask.findFirst({ where: { id: taskId, bikeId } });
    if (!task) throw new WorkshopError("Werkplaatsactiviteit niet gevonden.");
    if (task.checklistKey) throw new WorkshopError("Een inspectiepunt kan niet worden verwijderd; heropen of beoordeel het via de checklist.");
    if (task.costAppliedAt) await reverseTaskCostsTx(tx, bikeId, task);
    await tx.serviceTask.delete({ where: { id: task.id } });
  });
  await audit("bike.service_task_deleted", "Bike", bikeId, { taskId }, actor);
}

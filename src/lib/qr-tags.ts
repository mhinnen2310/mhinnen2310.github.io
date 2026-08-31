import { randomBytes } from "node:crypto";
import type { Prisma, QrTagStatus } from "@prisma/client";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;
export const QR_LOW_STOCK_THRESHOLD = 25;
export const QR_MAX_BATCH_SIZE = 500;

export class QrTagError extends Error { constructor(message: string) { super(message); this.name = "QrTagError"; } }

export function qrDisplayCode(serial: number) { return `DF-${String(serial).padStart(6, "0")}`; }
export function qrUrl(token: string, baseUrl = env.publicQrBaseUrl) { return `${baseUrl.replace(/\/$/, "")}/q/${token}`; }
export function createQrToken() { return randomBytes(32).toString("base64url"); }

async function reserveCounter(tx: Tx, kind: string, increment: number, year: number) {
  const counter = await tx.numberCounter.upsert({
    where: { year_kind: { year, kind } }, update: { lastNumber: { increment } }, create: { year, kind, lastNumber: increment },
  });
  return { first: counter.lastNumber - increment + 1, last: counter.lastNumber };
}

export async function createQrBatch(quantity: number, labelsPerPage: number, actor: SessionUser | null, now = new Date()) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > QR_MAX_BATCH_SIZE) throw new QrTagError(`Kies een aantal tussen 1 en ${QR_MAX_BATCH_SIZE}.`);
  if (labelsPerPage !== 10 && labelsPerPage !== 15) throw new QrTagError("Kies 10 of 15 labels per A4.");
  const batch = await prisma.$transaction(async (tx) => {
    const serials = await reserveCounter(tx, "qr-tag", quantity, 0);
    const batchNumber = await reserveCounter(tx, "qr-batch", 1, now.getFullYear());
    const created = await tx.qrBatch.create({ data: { batchNumber: `QR-${now.getFullYear()}-${String(batchNumber.last).padStart(4, "0")}`, qrBaseUrl: env.publicQrBaseUrl.replace(/\/$/, ""), firstSerialNumber: serials.first, lastSerialNumber: serials.last, quantity, labelsPerPage, createdById: actor?.id ?? null } });
    const tokens = new Set<string>();
    while (tokens.size < quantity) tokens.add(createQrToken());
    await tx.qrTag.createMany({ data: [...tokens].map((secureToken, offset) => { const serialNumber = serials.first + offset; return { batchId: created.id, serialNumber, displayCode: qrDisplayCode(serialNumber), secureToken }; }) });
    return created;
  }, { isolationLevel: "Serializable" });
  await audit("QR_BATCH_CREATED", "QrBatch", batch.id, { batchNumber: batch.batchNumber, quantity: batch.quantity, first: qrDisplayCode(batch.firstSerialNumber), last: qrDisplayCode(batch.lastSerialNumber) }, actor);
  return batch;
}

export async function bindQrTag(tagId: string, bikeId: string, actor: SessionUser) {
  const tag = await prisma.$transaction(async (tx) => {
    const bike = await tx.bike.findUnique({ where: { id: bikeId }, select: { id: true, inventoryCode: true } });
    if (!bike) throw new QrTagError("Fiets niet gevonden.");
    const changed = await tx.qrTag.updateMany({ where: { id: tagId, status: "UNUSED", bikeId: null }, data: { status: "BOUND", bikeId, boundAt: new Date(), boundById: actor.id } });
    if (changed.count !== 1) throw new QrTagError("Deze QR-tag is niet meer ongebruikt en kan niet worden gekoppeld.");
    return tx.qrTag.findUniqueOrThrow({ where: { id: tagId }, select: { id: true, displayCode: true, status: true, bikeId: true } });
  });
  await audit("QR_TAG_BOUND", "QrTag", tagId, { displayCode: tag.displayCode, bikeId }, actor);
  return tag;
}

/** Explicit admin-only correction; a tag is never returned to UNUSED. */
export async function correctQrBinding(tagId: string, bikeId: string, reason: string, actor: SessionUser) {
  if (!reason.trim() || reason.trim().length > 1_000) throw new QrTagError("Een korte reden voor de correctie is verplicht.");
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.qrTag.findUnique({ where: { id: tagId }, select: { id: true, status: true, bikeId: true, displayCode: true } });
    if (!current || current.status !== "BOUND" || !current.bikeId) throw new QrTagError("Alleen een gekoppelde QR-tag kan expliciet worden gecorrigeerd.");
    await tx.bike.findUniqueOrThrow({ where: { id: bikeId }, select: { id: true } });
    const tag = await tx.qrTag.update({ where: { id: tagId }, data: { bikeId, boundAt: new Date(), boundById: actor.id } });
    return { tag, previousBikeId: current.bikeId };
  });
  await audit("QR_TAG_BINDING_CORRECTED", "QrTag", tagId, { displayCode: result.tag.displayCode, previousBikeId: result.previousBikeId, newBikeId: bikeId, reason: reason.trim() }, actor);
  return result.tag;
}

export async function retireQrTag(tagId: string, reason: string, actor: SessionUser) {
  if (!reason.trim() || reason.trim().length > 1_000) throw new QrTagError("Een reden voor intrekken is verplicht.");
  const tag = await prisma.qrTag.updateMany({ where: { id: tagId, status: "UNUSED" }, data: { status: "RETIRED", retiredAt: new Date(), retiredReason: reason.trim() } });
  if (tag.count !== 1) throw new QrTagError("Alleen een ongebruikte QR-tag kan worden ingetrokken.");
  await audit("QR_TAG_RETIRED", "QrTag", tagId, { reason: reason.trim() }, actor);
}

export function matchesQrSearch(tag: { displayCode: string; serialNumber: number }, query: string) {
  const normalized = query.trim().toUpperCase().replace(/^DF-?/, "").replace(/^0+/, "") || "0";
  return tag.displayCode === query.trim().toUpperCase() || String(tag.serialNumber) === normalized;
}

export function publicQrState(status: QrTagStatus) { return status === "UNUSED" ? "Deze QR-code is nog niet aan een fiets gekoppeld." : "Deze QR-code is niet publiek beschikbaar."; }

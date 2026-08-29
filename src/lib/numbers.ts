import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

/**
 * Sequential, human-readable identifiers.
 * Orders:   DF-2026-000123
 * Invoices: DF-F-2026-00001
 * Bikes:    DF-B-2026-000001
 *
 * The counter is incremented atomically (single-row upsert) inside a
 * transaction; the number is final once issued. The transaction-scoped
 * variant (nextNumberInTx) must be used inside interactive transactions
 * (checkout, invoicing) so the counter and the record commit atomically.
 */
export type CounterKind = "order" | "invoice" | "bike";

type Tx = Prisma.TransactionClient;

async function nextNumberInTx(
  tx: Tx,
  kind: CounterKind,
  year: number,
  prefix: string,
  pad: number,
): Promise<string> {
  const counter = await tx.numberCounter.upsert({
    where: { year_kind: { year, kind } },
    update: { lastNumber: { increment: 1 } },
    create: { year, kind, lastNumber: 1 },
  });
  return `${prefix}-${year}-${String(counter.lastNumber).padStart(pad, "0")}`;
}

export function nextOrderNumberInTx(tx: Tx, date: Date = new Date()): Promise<string> {
  return nextNumberInTx(tx, "order", date.getFullYear(), "DF", 6);
}

export function nextInvoiceNumberInTx(tx: Tx, date: Date = new Date()): Promise<string> {
  return nextNumberInTx(tx, "invoice", date.getFullYear(), "DF-F", 5);
}

export function nextOrderNumber(date: Date = new Date()): Promise<string> {
  return prisma.$transaction((tx) => nextOrderNumberInTx(tx, date));
}

export function nextInvoiceNumber(date: Date = new Date()): Promise<string> {
  return prisma.$transaction((tx) => nextInvoiceNumberInTx(tx, date));
}

/**
 * Human-readable inventory number for newly created physical bikes. The
 * counter is transaction-scoped, so concurrent intakes can never receive the
 * same code. Historic codes remain untouched.
 */
export function nextBikeInventoryCodeInTx(tx: Tx, date: Date = new Date()): Promise<string> {
  return nextNumberInTx(tx, "bike", date.getFullYear(), "DF-B", 6);
}

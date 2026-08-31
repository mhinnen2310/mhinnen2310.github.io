import type { Prisma } from "@prisma/client";
import { roleAtLeast, type SessionUser } from "./auth";
import { nextOrderNumberInTx } from "./numbers";
import { checkoutReservationRows, uniqueBikeLinesForOrder } from "./order-lifecycle";
import { prisma } from "./prisma";
import { getTaxConfig, lineTax, taxRateForLine } from "./tax";
import { env } from "./env";

export class StaffSaleError extends Error { constructor(message: string) { super(message); this.name = "StaffSaleError"; } }

export interface StartStaffSaleInput {
  bikeIds: string[];
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  internalNotes?: string | null;
}

/**
 * Creates the pending order and its individual reservations for an in-store
 * sale. Prices, tax and reservation ownership are read/created only on the
 * server. Completion remains the sole route to SOLD.
 */
export async function startStaffSale(input: StartStaffSaleInput, actor: SessionUser) {
  if (!roleAtLeast(actor.role, "STAFF")) throw new StaffSaleError("Alleen bevoegd personeel kan een verkoop starten.");
  const bikeIds = [...new Set(input.bikeIds)];
  if (!bikeIds.length || bikeIds.length !== input.bikeIds.length || bikeIds.some((id) => !id)) throw new StaffSaleError("Kies één of meer unieke fietsen.");
  if (!input.customerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail.trim())) throw new StaffSaleError("Naam en geldig e-mailadres van de klant zijn verplicht voor de verkoopfactuur.");
  const taxConfig = await getTaxConfig();
  const expiresAt = new Date(Date.now() + env.reservationTtlMinutes * 60_000);
  return prisma.$transaction(async (tx) => {
    const bikes = await tx.bike.findMany({
      where: { id: { in: bikeIds } },
      select: { id: true, inventoryCode: true, title: true, priceCents: true, status: true, frameSizeCm: true, batteryWh: true, isElectric: true, acquisitionCostCents: true },
    });
    if (bikes.length !== bikeIds.length) throw new StaffSaleError("Eén of meer fietsen bestaan niet meer.");
    const byId = new Map(bikes.map((bike) => [bike.id, bike]));
    const lines = bikeIds.sort().map((id) => {
      const bike = byId.get(id)!;
      if (bike.status !== "AVAILABLE") throw new StaffSaleError(`${bike.inventoryCode} is niet beschikbaar voor verkoop.`);
      if (!Number.isSafeInteger(bike.priceCents) || bike.priceCents <= 0) throw new StaffSaleError(`${bike.inventoryCode} heeft geen geldige verkoopprijs.`);
      const rate = taxRateForLine(taxConfig, "UNIQUE_BIKE");
      const tax = lineTax(bike.priceCents, rate, taxConfig.basis, { scheme: taxConfig.bikeScheme, acquisitionCostCents: bike.acquisitionCostCents });
      if (tax.requiresCostBasis) throw new StaffSaleError(`${bike.inventoryCode} heeft geen vastgelegde inkoopprijs voor de margeregeling.`);
      return {
        kind: "UNIQUE_BIKE" as const, bikeId: bike.id, productId: null, name: bike.title, identifier: bike.inventoryCode,
        quantity: 1, unitPriceCents: bike.priceCents, lineTotalCents: bike.priceCents, taxRate: tax.rate, taxCents: tax.taxCents,
        acquisitionCostCents: bike.acquisitionCostCents, marginCents: tax.marginCents, marginVatCents: tax.scheme === "MARGIN" ? tax.taxCents : null, taxScheme: tax.scheme,
        specs: { frameSizeCm: bike.frameSizeCm, batteryWh: bike.batteryWh, isElectric: bike.isElectric }, imageKey: null,
      };
    });
    const orderedLines = uniqueBikeLinesForOrder(lines);
    const subtotalCents = orderedLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const taxTotalCents = orderedLines.reduce((sum, line) => sum + line.taxCents, 0);
    const totalCents = subtotalCents + (taxConfig.basis === "excl" ? taxTotalCents : 0);
    const orderNumber = await nextOrderNumberInTx(tx);
    const order = await tx.order.create({
      data: {
        orderNumber, customerName: input.customerName.trim(), customerEmail: input.customerEmail.trim().toLowerCase(),
        customerPhone: input.customerPhone?.trim() || null, customerCompany: input.customerCompany?.trim() || null,
        subtotalCents, taxTotalCents, totalCents, currency: "EUR", deliveryCostCents: 0,
        taxBasis: { basis: taxConfig.basis, bikeRate: taxConfig.bikeRate, accessoryRate: taxConfig.accessoryRate, bikeScheme: taxConfig.bikeScheme, requiresReview: taxConfig.requiresReview },
        internalNotes: input.internalNotes?.trim() || null,
        lines: { create: orderedLines },
      },
      select: { id: true, orderNumber: true, totalCents: true, currency: true },
    });
    for (const line of orderedLines) {
      const reserved = await tx.bike.updateMany({ where: { id: line.bikeId!, status: "AVAILABLE", priceCents: line.unitPriceCents }, data: { status: "RESERVED" } });
      if (reserved.count !== 1) throw new StaffSaleError("Een fiets wijzigde gelijktijdig; ververs de voorraad en probeer opnieuw.");
    }
    await tx.reservation.createMany({ data: checkoutReservationRows(order.id, orderedLines, { name: orderNumber, email: input.customerEmail.trim().toLowerCase() }, expiresAt).map((reservation) => ({ ...reservation, source: "MANUAL", customerName: input.customerName.trim() })) });
    await tx.auditLog.create({ data: { action: "staff_sale.started", entityType: "Order", entityId: order.id, actorId: actor.id, actorType: "USER", meta: { orderNumber, bikeIds: orderedLines.map((line) => line.bikeId), totalCents, expiresAt: expiresAt.toISOString() } as Prisma.InputJsonValue } });
    return { ...order, expiresAt };
  }, { isolationLevel: "Serializable" });
}

import type { BikeStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { marginVatCents } from "./tax";

const STOCK_STATUSES: BikeStatus[] = ["INTAKE", "WORKSHOP", "READY", "AVAILABLE", "RESERVED", "SALE_PENDING"];

export interface DashboardSnapshot {
  generatedAt: string;
  stockCount: number;
  availableCount: number;
  stockValueCents: number;
  soldThisMonth: number;
  revenueThisMonthCents: number;
  grossMarginThisMonthCents: number;
  marginVatThisMonthCents: number;
  pendingOrders: number;
  expiredReservations: number;
  incompleteWorkshop: number;
  lowAccessoryStock: number;
  manualReviews: number;
  byStatus: Record<string, number>;
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Shared read-only dashboard query for the web admin and staff app. */
export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const now = new Date();
  const start = monthStart(now);
  const [stockGroups, soldOrders, pendingOrders, products, expiredReservations, incompleteWorkshop, manualReviews] = await Promise.all([
    prisma.bike.groupBy({ by: ["status"], where: { status: { in: STOCK_STATUSES } }, _count: { _all: true }, _sum: { acquisitionCostCents: true } }),
    prisma.order.findMany({
      where: { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: start } },
      select: { lines: { where: { kind: "UNIQUE_BIKE" }, select: { lineTotalCents: true, taxRate: true, acquisitionCostCents: true, marginCents: true, marginVatCents: true, bike: { select: { acquisitionCostCents: true, partsCostCents: true, repairCostCents: true, otherCostCents: true } } } } },
    }),
    prisma.order.count({ where: { paymentStatus: "PENDING" } }),
    prisma.product.findMany({ where: { active: true }, select: { stockQuantity: true, lowStockThreshold: true } }),
    prisma.reservation.count({ where: { status: "ACTIVE", expiresAt: { lt: now } } }),
    prisma.bike.count({ where: { status: "WORKSHOP", serviceTasks: { some: { completed: false } } } }),
    prisma.payment.count({ where: { status: "paid_requires_manual_review" } }),
  ]);
  const count = (row: (typeof stockGroups)[number]) => typeof row._count === "object" && row._count ? row._count._all : 0;
  const byStatus = Object.fromEntries(stockGroups.map((row) => [row.status, count(row)]));
  const soldLines = soldOrders.flatMap((order) => order.lines);
  const revenueThisMonthCents = soldLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const grossMarginThisMonthCents = soldLines.reduce((sum, line) => {
    const cost = line.acquisitionCostCents ?? line.bike?.acquisitionCostCents ?? 0;
    const workshop = (line.bike?.partsCostCents ?? 0) + (line.bike?.repairCostCents ?? 0) + (line.bike?.otherCostCents ?? 0);
    return sum + (line.marginCents == null ? line.lineTotalCents - cost - workshop : line.marginCents - workshop);
  }, 0);
  const marginVatThisMonthCents = soldLines.reduce((sum, line) => sum + (line.marginVatCents ?? (line.acquisitionCostCents != null ? marginVatCents(line.lineTotalCents, line.acquisitionCostCents, line.taxRate || 21) : 0)), 0);
  return {
    generatedAt: now.toISOString(),
    stockCount: stockGroups.reduce((sum, row) => sum + count(row), 0),
    availableCount: byStatus.AVAILABLE ?? 0,
    stockValueCents: stockGroups.reduce((sum, row) => sum + (row._sum.acquisitionCostCents ?? 0), 0),
    soldThisMonth: soldLines.length,
    revenueThisMonthCents,
    grossMarginThisMonthCents,
    marginVatThisMonthCents,
    pendingOrders,
    expiredReservations,
    incompleteWorkshop,
    lowAccessoryStock: products.filter((item) => item.stockQuantity <= item.lowStockThreshold).length,
    manualReviews,
    byStatus,
  };
}

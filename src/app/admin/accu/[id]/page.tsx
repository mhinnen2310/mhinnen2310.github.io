import { notFound } from "next/navigation";
import { AdminBatteryEditor } from "@/components/admin-battery-manager";
import { prisma } from "@/lib/prisma";
import { numericValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBatteryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [battery, bikes] = await Promise.all([
    prisma.battery.findUnique({ where: { id }, include: {
      currentBike: { select: { id: true, inventoryCode: true, title: true } },
      assignments: { orderBy: { assignedAt: "desc" }, include: { bike: { select: { id: true, inventoryCode: true, title: true } }, changedBy: { select: { name: true, email: true } } } },
      repairs: { orderBy: { createdAt: "desc" }, include: { completedBy: { select: { name: true, email: true } } } },
    } }),
    prisma.bike.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, inventoryCode: true, title: true, currentBatteryId: true }, orderBy: { updatedAt: "desc" }, take: 500 }),
  ]);
  if (!battery) notFound();
  const normalized = { ...battery, nominalAh: numericValue(battery.nominalAh), measuredAh: numericValue(battery.measuredAh), sohPercent: numericValue(battery.sohPercent) };
  return <AdminBatteryEditor battery={normalized} bikes={bikes} />;
}

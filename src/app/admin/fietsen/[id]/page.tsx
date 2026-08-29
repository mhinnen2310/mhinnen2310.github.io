import { notFound } from "next/navigation";
import { AdminBikeEditor } from "@/components/admin-bike-forms";
import { computeMargin } from "@/lib/bikes";
import { prisma } from "@/lib/prisma";
import { numericValue } from "@/lib/utils";
import { ensureBikeIntake, ensureInspectionChecklist, getIntakeReadiness, getWorkshopReadiness } from "@/lib/workshop";

export const dynamic = "force-dynamic";

export default async function AdminBikePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await Promise.all([ensureBikeIntake(id), ensureInspectionChecklist(id)]);
  const [bike, auditEvents, intakeReadiness, workshopReadiness] = await Promise.all([
    prisma.bike.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        serviceTasks: { orderBy: [{ completed: "asc" }, { createdAt: "desc" }], include: { completedBy: { select: { name: true, email: true } } } },
        priceHistory: { orderBy: { createdAt: "desc" }, take: 50 },
        intakeRecord: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Bike", entityId: id },
      select: { id: true, action: true, meta: true, createdAt: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    getIntakeReadiness(id),
    getWorkshopReadiness(id),
  ]);
  if (!bike) notFound();

  return (
    <AdminBikeEditor
      bike={{ ...bike, wheelSizeInches: numericValue(bike.wheelSizeInches), batteryAh: numericValue(bike.batteryAh), batteryMeasuredAh: numericValue(bike.batteryMeasuredAh), batterySohPercent: numericValue(bike.batterySohPercent) }}
      margin={computeMargin(bike)}
      intakeReadiness={intakeReadiness}
      workshopReadiness={workshopReadiness}
      auditEvents={auditEvents.map((event) => ({
        ...event,
        actor: event.user?.name ?? event.user?.email ?? "Systeem",
        meta: event.meta ? JSON.stringify(event.meta) : null,
      }))}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { AdminAvailabilityCalendar } from "@/components/admin-availability-calendar";
import { AdminAppointmentCalendar } from "@/components/admin-appointment-calendar";
import {
  getAppointmentAvailability,
  todayInAmsterdam,
} from "@/lib/appointment-availability";

export default async function AdminAppointmentsPage() {
  const today = todayInAmsterdam();
  const periodStart = new Date(`${today}T00:00:00.000Z`);
  const periodEnd = new Date(periodStart); periodEnd.setUTCDate(periodEnd.getUTCDate() + 42);
  const [appointments, rules, overrides, availability, serviceTasks, serviceRequests] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: [{ preferredDate: "asc" }, { createdAt: "desc" }],
      take: 150,
      include: { bike: { select: { title: true, inventoryCode: true } } },
    }),
    prisma.appointmentAvailabilityRule.findMany({
      where: { active: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointmentAvailabilityOverride.findMany({
      where: { date: { gte: new Date(`${today}T00:00:00.000Z`) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 100,
    }),
    getAppointmentAvailability(41),
    prisma.serviceTask.findMany({
      where: { OR: [{ doneDate: { gte: periodStart, lt: periodEnd } }, { doneDate: null, createdAt: { gte: periodStart, lt: periodEnd } }] },
      orderBy: { createdAt: "asc" }, take: 200,
      include: { bike: { select: { title: true, inventoryCode: true } } },
    }),
    prisma.serviceRequest.findMany({
      where: { createdAt: { gte: periodStart, lt: periodEnd } },
      orderBy: { createdAt: "asc" }, take: 200,
      include: { bike: { select: { title: true, inventoryCode: true } } },
    }),
  ]);
  const serviceEvents = [
    ...serviceTasks.map((item) => {
      const date = item.doneDate ?? item.createdAt;
      return { id: `task:${item.id}`, date: date.toISOString(), time: item.doneDate ? date.toISOString().slice(11, 16) : "Te plannen", title: `Werkplaats · ${item.bike.inventoryCode}`, body: item.description, bike: item.bike };
    }),
    ...serviceRequests.map((item) => ({ id: `request:${item.id}`, requestId: item.id, date: item.createdAt.toISOString(), time: item.createdAt.toISOString().slice(11, 16), title: `Serviceverzoek · ${item.customerName}`, body: item.description, status: item.status, bike: item.bike })),
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        Afspraken & proefritten
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Neem contact op, bevestig de afspraak en werk de status direct bij.
      </p>
      <AdminAvailabilityCalendar
        rules={rules.map(
          ({ id, weekday, startTime, endTime, slotMinutes }) => ({
            id,
            weekday,
            startTime,
            endTime,
            slotMinutes,
          }),
        )}
        overrides={overrides.map(
          ({ id, date, closed, startTime, endTime, slotMinutes, note }) => ({
            id,
            date: date.toISOString().slice(0, 10),
            closed,
            startTime,
            endTime,
            slotMinutes,
            note,
          }),
        )}
        availability={availability}
        today={today}
        showCalendar={false}
      />
      <AdminAppointmentCalendar
        appointments={appointments.map((item) => ({
          ...item,
          preferredDate: item.preferredDate.toISOString(),
        }))}
        availability={availability}
        serviceEvents={serviceEvents}
        today={today}
      />
    </div>
  );
}

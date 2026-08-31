import { prisma } from "@/lib/prisma";
import { AdminAvailabilityCalendar } from "@/components/admin-availability-calendar";
import { AdminAppointmentCalendar } from "@/components/admin-appointment-calendar";
import {
  getAppointmentAvailability,
  todayInAmsterdam,
} from "@/lib/appointment-availability";

export default async function AdminAppointmentsPage() {
  const today = todayInAmsterdam();
  const [appointments, rules, overrides, availability] = await Promise.all([
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
  ]);
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
      />
      <AdminAppointmentCalendar
        appointments={appointments.map((item) => ({
          ...item,
          preferredDate: item.preferredDate.toISOString(),
        }))}
        today={today}
      />
    </div>
  );
}

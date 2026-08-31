import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { parseDateKey, validateWindow } from "@/lib/appointment-availability";

export async function POST(request: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }

  try {
    const action = body.action;
    if (action === "addRule") {
      const weekday = Number(body.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Kies een geldige weekdag.");
      const window = validateWindow(body.startTime, body.endTime, body.slotMinutes);
      const item = await prisma.appointmentAvailabilityRule.create({ data: { weekday, ...window } });
      await audit("appointment_availability.rule_added", "AppointmentAvailabilityRule", item.id, { weekday, ...window }, actor);
    } else if (action === "addDateWindow") {
      const date = parseDateKey(body.date);
      const window = validateWindow(body.startTime, body.endTime, body.slotMinutes);
      const dateValue = new Date(`${date}T00:00:00.000Z`);
      const item = await prisma.$transaction(async (tx) => {
        await tx.appointmentAvailabilityOverride.deleteMany({ where: { date: dateValue, closed: true } });
        return tx.appointmentAvailabilityOverride.create({ data: { date: dateValue, ...window } });
      });
      await audit("appointment_availability.date_added", "AppointmentAvailabilityOverride", item.id, { date, ...window }, actor);
    } else if (action === "closeDate") {
      const date = parseDateKey(body.date);
      const dateValue = new Date(`${date}T00:00:00.000Z`);
      const item = await prisma.$transaction(async (tx) => {
        await tx.appointmentAvailabilityOverride.deleteMany({ where: { date: dateValue } });
        return tx.appointmentAvailabilityOverride.create({ data: { date: dateValue, closed: true } });
      });
      await audit("appointment_availability.date_closed", "AppointmentAvailabilityOverride", item.id, { date }, actor);
    } else if (action === "deleteRule") {
      if (typeof body.id !== "string") throw new Error("Regel niet gevonden.");
      await prisma.appointmentAvailabilityRule.delete({ where: { id: body.id } });
      await audit("appointment_availability.rule_deleted", "AppointmentAvailabilityRule", body.id, null, actor);
    } else if (action === "deleteOverride") {
      if (typeof body.id !== "string") throw new Error("Uitzondering niet gevonden.");
      await prisma.appointmentAvailabilityOverride.delete({ where: { id: body.id } });
      await audit("appointment_availability.override_deleted", "AppointmentAvailabilityOverride", body.id, null, actor);
    } else {
      throw new Error("Onbekende actie.");
    }
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Opslaan is mislukt." }, { status: 400 });
  }
}

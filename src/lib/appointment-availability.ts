import { prisma } from "./prisma";

export type AvailabilitySlot = { value: string; label: string };
export type AvailabilityDay = { date: string; label: string; slots: AvailabilitySlot[] };

const ACTIVE_APPOINTMENT_STATUSES = ["NEW", "CONTACTED", "CONFIRMED"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayInAmsterdam(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseDateKey(value: unknown): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) throw new Error("Kies een geldige datum.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) throw new Error("Kies een geldige datum.");
  return value;
}

export function parseClockTime(value: unknown, label = "Tijd"): string {
  if (typeof value !== "string" || !TIME_RE.test(value)) throw new Error(`${label} is ongeldig.`);
  return value;
}

export function parseSlotMinutes(value: unknown): number {
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240 || minutes % 15 !== 0) {
    throw new Error("De duur moet 15 tot 240 minuten zijn, in stappen van 15 minuten.");
  }
  return minutes;
}

export function validateWindow(startTime: unknown, endTime: unknown, slotMinutes: unknown) {
  const start = parseClockTime(startTime, "Starttijd");
  const end = parseClockTime(endTime, "Eindtijd");
  const duration = parseSlotMinutes(slotMinutes);
  if (clockMinutes(end) <= clockMinutes(start)) throw new Error("De eindtijd moet na de starttijd liggen.");
  if (clockMinutes(end) - clockMinutes(start) < duration) throw new Error("Het tijdvak is korter dan één afspraak.");
  return { startTime: start, endTime: end, slotMinutes: duration };
}

function clockMinutes(value: string): number {
  const parts = value.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return hours * 60 + minutes;
}

function clockValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function slotsForWindow(startTime: string, endTime: string, slotMinutes: number): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const end = clockMinutes(endTime);
  for (let start = clockMinutes(startTime); start + slotMinutes <= end; start += slotMinutes) {
    const from = clockValue(start);
    const to = clockValue(start + slotMinutes);
    const value = `${from}–${to}`;
    slots.push({ value, label: value });
  }
  return slots;
}

function dutchDateLabel(key: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00.000Z`));
}

export async function getAppointmentAvailability(daysAhead = 90): Promise<AvailabilityDay[]> {
  const startKey = todayInAmsterdam();
  const start = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + daysAhead + 1);

  const [rules, overrides, appointments] = await Promise.all([
    prisma.appointmentAvailabilityRule.findMany({ where: { active: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    prisma.appointmentAvailabilityOverride.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: { preferredDate: { gte: start, lt: end }, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] } },
      select: { preferredDate: true, timeBlock: true },
    }),
  ]);

  const overridesByDate = new Map<string, typeof overrides>();
  for (const item of overrides) {
    const key = dateKey(item.date);
    overridesByDate.set(key, [...(overridesByDate.get(key) ?? []), item]);
  }
  const occupied = new Set(appointments.map((item) => `${dateKey(item.preferredDate)}|${item.timeBlock}`));
  const result: AvailabilityDay[] = [];

  for (let offset = 0; offset <= daysAhead; offset++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = dateKey(day);
    const dateOverrides = overridesByDate.get(key);
    const slots = new Map<string, AvailabilitySlot>();

    if (dateOverrides) {
      if (!dateOverrides.some((item) => item.closed)) {
        for (const item of dateOverrides) {
          if (!item.startTime || !item.endTime || !item.slotMinutes) continue;
          for (const slot of slotsForWindow(item.startTime, item.endTime, item.slotMinutes)) slots.set(slot.value, slot);
        }
      }
    } else {
      for (const rule of rules.filter((item) => item.weekday === day.getUTCDay())) {
        for (const slot of slotsForWindow(rule.startTime, rule.endTime, rule.slotMinutes)) slots.set(slot.value, slot);
      }
    }

    const available = [...slots.values()]
      .sort((a, b) => a.value.localeCompare(b.value))
      .filter((slot) => !occupied.has(`${key}|${slot.value}`));
    if (available.length) result.push({ date: key, label: dutchDateLabel(key), slots: available });
  }
  return result;
}

export async function assertAppointmentSlotAvailable(date: string, timeBlock: string): Promise<Date> {
  const key = parseDateKey(date);
  if (typeof timeBlock !== "string") throw new Error("Kies een tijdslot.");
  const today = todayInAmsterdam();
  const max = new Date(`${today}T00:00:00.000Z`);
  max.setUTCDate(max.getUTCDate() + 90);
  if (key < today) throw new Error("De gekozen datum ligt in het verleden.");
  if (key > dateKey(max)) throw new Error("Kies een datum binnen de komende 90 dagen.");

  const days = await getAppointmentAvailability(90);
  const available = days.find((day) => day.date === key)?.slots.some((slot) => slot.value === timeBlock);
  if (!available) throw new Error("Dit tijdslot is niet meer beschikbaar. Kies een ander tijdstip.");
  return new Date(`${key}T00:00:00.000Z`);
}

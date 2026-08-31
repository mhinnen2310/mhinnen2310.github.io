"use client";

import { useMemo, useState } from "react";
import { AdminStatusControl } from "@/components/admin-status-control";

type Appointment = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  preferredDate: string;
  timeBlock: string;
  message: string | null;
  status: string;
  internalNotes: string | null;
  bike: { title: string; inventoryCode: string } | null;
};
type AvailabilityDay = { date: string; slots: Array<{ value: string; label: string }> };
type ServiceEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  body: string;
  status?: string;
  bike?: { title: string; inventoryCode: string } | null;
  requestId?: string;
};
type CalendarEvent =
  | { id: string; date: string; time: string; kind: "availability"; title: string; body: string }
  | { id: string; date: string; time: string; kind: "appointment"; title: string; body: string; appointment: Appointment }
  | { id: string; date: string; time: string; kind: "service"; title: string; body: string; service: ServiceEvent };

const OPTIONS = [
  { value: "NEW", label: "Nieuw" },
  { value: "CONTACTED", label: "Contact gehad" },
  { value: "CONFIRMED", label: "Bevestigd" },
  { value: "COMPLETED", label: "Afgerond" },
  { value: "CANCELLED", label: "Geannuleerd" },
  { value: "NO_SHOW", label: "Niet verschenen" },
];
const SERVICE_OPTIONS = [
  { value: "NEW", label: "Nieuw" },
  { value: "IN_PROGRESS", label: "In behandeling" },
  { value: "AWAITING_CUSTOMER", label: "Wacht op klant" },
  { value: "RESOLVED", label: "Opgelost" },
  { value: "CLOSED", label: "Gesloten" },
  { value: "CANCELLED", label: "Geannuleerd" },
];
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function keyOf(date: Date) { return date.toISOString().slice(0, 10); }
function mondayOf(date: Date) {
  const copy = new Date(date); const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day); copy.setHours(12, 0, 0, 0); return copy;
}
function shortDate(value: string) { return new Date(value).toLocaleDateString("nl-NL", { dateStyle: "full" }); }

export function AdminAppointmentCalendar({
  appointments,
  availability = [],
  serviceEvents = [],
  today,
}: {
  appointments: Appointment[];
  availability?: AvailabilityDay[];
  serviceEvents?: ServiceEvent[];
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(appointments[0]?.id ?? serviceEvents[0]?.id ?? null);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = useMemo(() => mondayOf(new Date(`${today}T12:00:00`)), [today]);
  const periodStart = useMemo(() => { const date = new Date(start); date.setDate(start.getDate() + weekOffset * 42); return date; }, [start, weekOffset]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => { const date = new Date(periodStart); date.setDate(periodStart.getDate() + index); return { date, key: keyOf(date) }; }), [periodStart]);
  const events = useMemo<CalendarEvent[]>(() => [
    ...availability.flatMap((day) => day.slots.map((slot) => ({ id: `availability:${day.date}:${slot.value}`, date: day.date, time: slot.label, kind: "availability" as const, title: "Beschikbaar", body: "Vrije proefrit- of afspraaktijd." }))),
    ...appointments.map((appointment) => ({ id: appointment.id, date: keyOf(new Date(appointment.preferredDate)), time: appointment.timeBlock, kind: "appointment" as const, title: appointment.customerName, body: appointment.message ?? "Proefrit of afspraak", appointment })),
    ...serviceEvents.map((service) => ({ id: service.id, date: service.date.slice(0, 10), time: service.time, kind: "service" as const, title: service.title, body: service.body, service })),
  ], [availability, appointments, serviceEvents]);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) { const list = map.get(event.date) ?? []; list.push(event); map.set(event.date, list); }
    return map;
  }, [events]);
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const visibleKeys = new Set(days.map((day) => day.key));
  const outside = events.filter((event) => !visibleKeys.has(event.date));
  return (
    <section className="mt-8 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-semibold text-ink">Gedeelde agenda</h3><p className="mt-1 text-sm text-ink-soft">Beschikbaarheid, klantafspraken en werkplaats/service staan bij elkaar. Klik op een blok voor details.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">← Vorige</button><button type="button" onClick={() => setWeekOffset(0)} className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">Vandaag</button><button type="button" onClick={() => setWeekOffset((value) => value + 1)} className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">Volgende →</button></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-emerald-200" />Beschikbaar</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-brand-200" />Afspraak</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-200" />Service/werkplaats</span></div>
      <p className="mt-2 text-xs text-ink-faint">{appointments.length} afspraken · {availability.reduce((sum, day) => sum + day.slots.length, 0)} vrije blokken · {serviceEvents.length} service-items · periode {days[0]?.date.toLocaleDateString("nl-NL")} t/m {days[41]?.date.toLocaleDateString("nl-NL")}</p>
      <div className="mt-4 overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">{DAYS.map((day) => <div key={day} className="pb-1">{day}</div>)}</div><div className="grid grid-cols-7 gap-1">{days.map(({ date, key }) => { const items = grouped.get(key) ?? []; const isToday = key === today; return <div key={key} className={`min-h-32 rounded-lg border p-1.5 ${isToday ? "border-brand-500 bg-brand-50" : "border-line bg-surface"}`}><p className="text-xs font-semibold text-ink">{date.getDate()} <span className="font-normal text-ink-faint">{date.toLocaleDateString("nl-NL", { month: "short" })}</span></p><div className="mt-1 space-y-1">{items.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs ${item.id === selectedId ? "bg-brand-700 text-white" : item.kind === "availability" ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : item.kind === "service" ? "bg-amber-100 text-amber-950 hover:bg-amber-200" : "bg-card text-brand-800 hover:bg-brand-100"}`} title={`${item.time} · ${item.title}`}>{item.time} · {item.title}</button>)}{items.length > 8 && <p className="px-1 text-[10px] text-ink-faint">+{items.length - 8} meer</p>}</div></div>; })}</div></div></div>
      {selected?.kind === "appointment" && <article className="mt-5 rounded-lg border border-brand-200 bg-brand-50 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h4 className="font-semibold text-brand-950">{selected.appointment.customerName}</h4><p className="text-sm text-brand-900">{shortDate(selected.appointment.preferredDate)} · {selected.appointment.timeBlock}</p>{selected.appointment.bike && <p className="mt-1 text-xs text-brand-800">{selected.appointment.bike.inventoryCode} · {selected.appointment.bike.title}</p>}</div><AdminStatusControl entity="appointment" id={selected.appointment.id} value={selected.appointment.status} options={OPTIONS} /></div><div className="mt-3 flex flex-wrap gap-3 text-sm"><a href={`mailto:${selected.appointment.customerEmail}`} className="text-brand-800 underline">{selected.appointment.customerEmail}</a>{selected.appointment.customerPhone && <a href={`tel:${selected.appointment.customerPhone}`} className="text-brand-800 underline">{selected.appointment.customerPhone}</a>}</div>{selected.appointment.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-sm text-brand-950">{selected.appointment.message}</p>}{selected.appointment.internalNotes && <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-brand-900">Interne notitie: {selected.appointment.internalNotes}</p>}</article>}
      {selected?.kind === "availability" && <article className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><h4 className="font-semibold text-emerald-950">Beschikbaar blok</h4><p className="mt-1 text-sm text-emerald-900">{shortDate(selected.date)} · {selected.time}</p><p className="mt-2 text-sm text-emerald-900">Dit tijdstip kan door een klant geboekt worden. Klik op een afspraak om de klantgegevens te zien.</p></article>}
      {selected?.kind === "service" && <article className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h4 className="font-semibold text-amber-950">{selected.service.title}</h4><p className="text-sm text-amber-900">{shortDate(selected.date)} · {selected.time}</p><p className="mt-2 text-sm text-amber-900">{selected.service.body}</p>{selected.service.bike && <p className="mt-1 text-xs text-amber-800">{selected.service.bike.inventoryCode} · {selected.service.bike.title}</p>}</div>{selected.service.requestId && <AdminStatusControl entity="serviceRequest" id={selected.service.requestId} value={selected.service.status ?? "NEW"} options={SERVICE_OPTIONS} />}</div></article>}
      {!selected && <p className="mt-5 rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-faint">Klik een blok in de agenda.</p>}
      {outside.length > 0 && <p className="mt-3 text-xs text-ink-faint">{outside.length} item(s) vallen buiten deze periode. Gebruik Vorige/Volgende om ze te openen.</p>}
    </section>
  );
}

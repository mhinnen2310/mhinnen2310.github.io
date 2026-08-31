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
const OPTIONS = [
  { value: "NEW", label: "Nieuw" },
  { value: "CONTACTED", label: "Contact gehad" },
  { value: "CONFIRMED", label: "Bevestigd" },
  { value: "COMPLETED", label: "Afgerond" },
  { value: "CANCELLED", label: "Geannuleerd" },
  { value: "NO_SHOW", label: "Niet verschenen" },
];
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function keyOf(date: Date) {
  return date.toISOString().slice(0, 10);
}
function mondayOf(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function AdminAppointmentCalendar({
  appointments,
  today,
}: {
  appointments: Appointment[];
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    appointments[0]?.id ?? null,
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const start = useMemo(() => mondayOf(new Date(`${today}T12:00:00`)), [today]);
  const periodStart = useMemo(() => {
    const date = new Date(start);
    date.setDate(start.getDate() + weekOffset * 42);
    return date;
  }, [start, weekOffset]);
  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const date = new Date(periodStart);
        date.setDate(periodStart.getDate() + index);
        return { date, key: keyOf(date) };
      }),
    [periodStart],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = keyOf(new Date(appointment.preferredDate));
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [appointments]);
  const selected =
    appointments.find((appointment) => appointment.id === selectedId) ?? null;
  const visibleKeys = new Set(days.map((day) => day.key));
  const outside = appointments.filter(
    (appointment) =>
      !visibleKeys.has(keyOf(new Date(appointment.preferredDate))),
  );
  return (
    <section className="mt-8 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            Afspraken in agenda
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Klik op een afspraak voor contactgegevens, bericht en status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value - 1)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
          >
            ← Vorige
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
          >
            Vandaag
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value + 1)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
          >
            Volgende →
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {appointments.length} afspraken geladen · periode{" "}
        {days[0]?.date.toLocaleDateString("nl-NL")} t/m{" "}
        {days[41]?.date.toLocaleDateString("nl-NL")}
      </p>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {DAYS.map((day) => (
              <div key={day} className="pb-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(({ date, key }) => {
              const items = grouped.get(key) ?? [];
              const isToday = key === today;
              return (
                <div
                  key={key}
                  className={`min-h-28 rounded-lg border p-1.5 ${isToday ? "border-brand-500 bg-brand-50" : "border-line bg-surface"}`}
                >
                  <p className="text-xs font-semibold text-ink">
                    {date.getDate()}{" "}
                    <span className="font-normal text-ink-faint">
                      {date.toLocaleDateString("nl-NL", { month: "short" })}
                    </span>
                  </p>
                  <div className="mt-1 space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs ${item.id === selectedId ? "bg-brand-700 text-white" : "bg-card text-brand-800 hover:bg-brand-100"}`}
                        title={`${item.timeBlock} · ${item.customerName}`}
                      >
                        {item.timeBlock} · {item.customerName}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selected ? (
        <article className="mt-5 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="font-semibold text-brand-950">
                {selected.customerName}
              </h4>
              <p className="text-sm text-brand-900">
                {new Date(selected.preferredDate).toLocaleDateString("nl-NL", {
                  dateStyle: "full",
                })}{" "}
                · {selected.timeBlock}
              </p>
              {selected.bike && (
                <p className="mt-1 text-xs text-brand-800">
                  {selected.bike.inventoryCode} · {selected.bike.title}
                </p>
              )}
            </div>
            <AdminStatusControl
              entity="appointment"
              id={selected.id}
              value={selected.status}
              options={OPTIONS}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a
              href={`mailto:${selected.customerEmail}`}
              className="text-brand-800 underline"
            >
              {selected.customerEmail}
            </a>
            {selected.customerPhone && (
              <a
                href={`tel:${selected.customerPhone}`}
                className="text-brand-800 underline"
              >
                {selected.customerPhone}
              </a>
            )}
          </div>
          {selected.message && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-sm text-brand-950">
              {selected.message}
            </p>
          )}
          {selected.internalNotes && (
            <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-brand-900">
              Interne notitie: {selected.internalNotes}
            </p>
          )}
        </article>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-faint">
          Klik een afspraak in de kalender.
        </p>
      )}
      {outside.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          {outside.length} afspraak/afspraken valt buiten deze periode. Gebruik
          Vorige/Volgende om ze in de kalender te openen.
        </p>
      )}
    </section>
  );
}

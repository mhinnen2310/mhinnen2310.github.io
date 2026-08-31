"use client";

import { useState } from "react";

type Rule = { id: string; weekday: number; startTime: string; endTime: string; slotMinutes: number };
type Override = { id: string; date: string; closed: boolean; startTime: string | null; endTime: string | null; slotMinutes: number | null; note: string | null };
type Day = { date: string; slots: Array<{ value: string; label: string }> };

const WEEKDAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const inputClass = "rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";

export function AdminAvailabilityCalendar({ rules, overrides, availability, today, showCalendar = true }: { rules: Rule[]; overrides: Override[]; availability: Day[]; today: string; showCalendar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(payload: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/appointment-availability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Opslaan is mislukt.");
      window.location.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Opslaan is mislukt."); setBusy(false); }
  }

  function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action({ action: "addRule", weekday: Number(form.get("weekday")), startTime: form.get("startTime"), endTime: form.get("endTime"), slotMinutes: Number(form.get("slotMinutes")) });
  }
  function submitDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action({ action: "addDateWindow", date: form.get("date"), startTime: form.get("startTime"), endTime: form.get("endTime"), slotMinutes: Number(form.get("slotMinutes")) });
  }

  const availableByDate = new Map(availability.map((day) => [day.date, day.slots]));
  const calendarDays = Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(`${today}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return { key, day: date.getUTCDate(), slots: availableByDate.get(key) ?? [] };
  });
  const calendarHeaders = calendarDays.slice(0, 7).map((item) => WEEKDAYS[new Date(`${item.key}T00:00:00.000Z`).getUTCDay()]);

  return <section className="mt-6 rounded-xl border border-line bg-card p-5">
    <h3 className="text-lg font-semibold text-ink">Beschikbaarheidsregels</h3>
    <p className="mt-1 text-sm text-ink-soft">De agenda is standaard gesloten. Losse datums overschrijven de vaste uren van die weekdag.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-state-error">{error}</p>}
    {showCalendar && <div className="mt-5 overflow-x-auto">
      <h4 className="mb-2 font-semibold text-ink">Agenda komende 6 weken</h4>
      <div className="grid min-w-[760px] grid-cols-7 gap-1 text-center text-xs text-ink-faint">{calendarHeaders.map((label, index) => <div key={`${label}-${index}`} className="pb-1 capitalize">{index === 0 ? `${label} (vandaag)` : label}</div>)}
        {calendarDays.map((item) => <div key={item.key} className={`min-h-24 rounded-lg border p-2 text-left ${item.slots.length ? "border-brand-200 bg-brand-50" : "border-line bg-surface"}`}><p className="font-semibold text-ink">{item.day} <span className="font-normal text-ink-faint">{item.key.slice(5)}</span></p>{item.slots.length ? <div className="mt-1 space-y-1">{item.slots.map((slot) => <p key={slot.value} className="rounded bg-card px-1 py-0.5 text-brand-800">{slot.label}</p>)}</div> : <p className="mt-2 text-ink-faint">gesloten</p>}</div>)}
      </div>
    </div>}
    <div className="mt-5 grid gap-6 xl:grid-cols-2">
      <div><h4 className="font-semibold text-ink">Vaste weekdagen</h4>
        <form onSubmit={submitRule} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select name="weekday" aria-label="Weekdag" className={`${inputClass} col-span-2 sm:col-span-1`}>{WEEKDAYS.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}<option value="0">zondag</option></select>
          <input name="startTime" aria-label="Starttijd" type="time" defaultValue="09:00" required className={inputClass} />
          <input name="endTime" aria-label="Eindtijd" type="time" defaultValue="12:00" required className={inputClass} />
          <select name="slotMinutes" aria-label="Duur" defaultValue="60" className={inputClass}>{[30,45,60,90,120].map((n) => <option key={n} value={n}>{n} min.</option>)}</select>
          <button disabled={busy} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white">Toevoegen</button>
        </form>
        <div className="mt-3 space-y-2">{rules.map((rule) => <div key={rule.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"><span className="capitalize">{WEEKDAYS[rule.weekday]} · {rule.startTime}–{rule.endTime} · {rule.slotMinutes} min.</span><button type="button" disabled={busy} onClick={() => void action({ action: "deleteRule", id: rule.id })} className="text-state-error underline">Verwijder</button></div>)}{!rules.length && <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-faint">Nog geen vaste uren: de agenda blijft gesloten.</p>}</div>
      </div>
      <div><h4 className="font-semibold text-ink">Losse datum</h4>
        <form onSubmit={submitDate} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input name="date" aria-label="Datum" type="date" required className={`${inputClass} col-span-2 sm:col-span-1`} />
          <input name="startTime" aria-label="Starttijd" type="time" defaultValue="09:00" required className={inputClass} />
          <input name="endTime" aria-label="Eindtijd" type="time" defaultValue="12:00" required className={inputClass} />
          <select name="slotMinutes" aria-label="Duur" defaultValue="60" className={inputClass}>{[30,45,60,90,120].map((n) => <option key={n} value={n}>{n} min.</option>)}</select>
          <button disabled={busy} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white">Openzetten</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action({ action: "closeDate", date: form.get("date") }); }} className="mt-2 flex gap-2"><input name="date" aria-label="Datum blokkeren" type="date" required className={`${inputClass} flex-1`} /><button disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink">Hele dag blokkeren</button></form>
        <div className="mt-3 space-y-2">{overrides.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"><span>{item.date} · {item.closed ? "hele dag gesloten" : `${item.startTime}–${item.endTime} · ${item.slotMinutes} min.`}</span><button type="button" disabled={busy} onClick={() => void action({ action: "deleteOverride", id: item.id })} className="text-state-error underline">Verwijder</button></div>)}{!overrides.length && <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-faint">Nog geen uitzonderingen ingesteld.</p>}</div>
      </div>
    </div>
  </section>;
}

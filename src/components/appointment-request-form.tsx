"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AvailabilityDay } from "@/lib/appointment-availability";

export function AppointmentRequestForm({ availability, bikeId }: { availability: AvailabilityDay[]; bikeId?: string }) {
  const [date, setDate] = useState(availability[0]?.date ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const slots = useMemo(() => availability.find((day) => day.date === date)?.slots ?? [], [availability, date]);

  if (success) {
    return <div className="rounded-xl border border-brand-200 bg-brand-50 p-5"><h2 className="font-semibold text-brand-900">Aanvraag ontvangen</h2><p className="mt-1 text-sm text-brand-800">We nemen contact met je op om de afspraak te bevestigen. De aanvraag is nog geen definitieve boeking.</p></div>;
  }
  if (!availability.length) {
    return <div className="rounded-xl border border-line bg-card p-5"><h2 className="font-semibold text-ink">Momenteel geen proefritmomenten beschikbaar</h2><p className="mt-1 text-sm text-ink-soft">Er zijn nog geen vrije momenten in de agenda gezet. Neem gerust contact op, dan kijken we samen wat mogelijk is.</p><Link href="/contact" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Neem contact op</Link></div>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "De aanvraag kon niet worden verzonden.");
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
  return <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-card p-5 sm:p-6">
    {error && <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-3 py-2 text-sm text-state-error">{error}</p>}
    {bikeId && <input type="hidden" name="bikeId" value={bikeId} />}
    <label className="block text-sm text-ink-soft">Naam<input className={inputClass} name="name" required autoComplete="name" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm text-ink-soft">E-mailadres<input className={inputClass} type="email" name="email" required autoComplete="email" /></label>
      <label className="block text-sm text-ink-soft">Telefoon (optioneel)<input className={inputClass} type="tel" name="phone" autoComplete="tel" /></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm text-ink-soft">Beschikbare datum<select className={inputClass} name="preferredDate" value={date} onChange={(event) => setDate(event.target.value)} required>{availability.map((day) => <option key={day.date} value={day.date}>{day.label}</option>)}</select></label>
      <label className="block text-sm text-ink-soft">Tijdslot<select className={inputClass} name="timeBlock" key={date} required>{slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label>
    </div>
    <label className="block text-sm text-ink-soft">Bericht (optioneel)<textarea className={inputClass} name="message" rows={4} placeholder={bikeId ? "Vraag over deze fiets, gewenste route, …" : "Welke fiets wil je bekijken? Wat is je vraag?"} /></label>
    <button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Versturen…" : "Aanvraag versturen"}</button>
  </form>;
}

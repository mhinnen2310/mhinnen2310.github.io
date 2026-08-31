"use client";

import { useState } from "react";

async function postAction(path: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "Actie mislukt.");
}

export function AdminQrBindForm({ tagId, displayCode }: { tagId: string; displayCode: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const inventoryCode = String(new FormData(event.currentTarget).get("inventoryCode") ?? "").trim(); if (!inventoryCode) return;
    setBusy(true); setMessage(null);
    try { await postAction(`/api/admin/qr/tags/${tagId}/bind`, { inventoryCode }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "De verbinding is mislukt."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 rounded-xl border border-line bg-card p-5"><h2 className="font-semibold text-ink">{displayCode} koppelen</h2><p className="mt-1 text-sm text-ink-soft">Vul het bestaande inventarisnummer van de intakefiets in.</p><div className="mt-3 flex flex-wrap gap-3"><input name="inventoryCode" required placeholder="DF-B-2026-000001" className="rounded-lg border border-line px-3 py-2 text-sm text-ink" /><button disabled={busy} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Koppelen…" : "Koppel aan fiets"}</button></div>{message && <p className="mt-3 text-sm text-state-error">{message}</p>}</form>;
}

export function AdminQrRetireForm({ tagId }: { tagId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason || !window.confirm("Deze ongebruikte QR-tag definitief intrekken?")) return;
    setBusy(true); setMessage(null);
    try { await postAction(`/api/admin/qr/tags/${tagId}/retire`, { reason }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Intrekken mislukt."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 rounded-xl border border-state-error/30 bg-red-50 p-5"><h2 className="font-semibold text-state-error">Tag intrekken</h2><p className="mt-1 text-sm text-ink-soft">Alleen voor een ongebruikt, beschadigd of kwijtgeraakt label.</p><textarea name="reason" required maxLength={1000} rows={2} placeholder="Reden voor intrekken" className="mt-3 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /><button disabled={busy} className="mt-3 rounded-lg border border-state-error px-3 py-2 text-sm font-semibold text-state-error disabled:opacity-60">{busy ? "Intrekken…" : "Tag definitief intrekken"}</button>{message && <p className="mt-3 text-sm text-state-error">{message}</p>}</form>;
}

export function AdminQrCorrectForm({ tagId, currentInventoryCode }: { tagId: string; currentInventoryCode: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const inventoryCode = String(data.get("inventoryCode") ?? "").trim(); const reason = String(data.get("reason") ?? "").trim();
    if (!inventoryCode || !reason || !window.confirm(`Koppeling van ${currentInventoryCode} corrigeren naar ${inventoryCode}?`)) return;
    setBusy(true); setMessage(null);
    try { await postAction(`/api/admin/qr/tags/${tagId}/correct`, { inventoryCode, reason }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Correctie mislukt."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 rounded-xl border border-state-warning/40 bg-state-warning/10 p-5"><h2 className="font-semibold text-ink">Koppeling corrigeren</h2><p className="mt-1 text-sm text-ink-soft">Alleen gebruiken voor een aantoonbare verkeerde koppeling. De reden wordt geaudit.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input name="inventoryCode" required placeholder="Nieuw inventarisnummer" className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /><input name="reason" required maxLength={1000} placeholder="Reden voor correctie" className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /></div><button disabled={busy} className="mt-3 rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-60">{busy ? "Corrigeren…" : "Koppeling corrigeren"}</button>{message && <p className="mt-3 text-sm text-state-error">{message}</p>}</form>;
}

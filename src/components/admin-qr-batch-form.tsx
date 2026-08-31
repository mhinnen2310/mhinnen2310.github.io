"use client";
import { useState } from "react";

export function AdminQrBatchForm() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const quantity = Number(form.get("quantity")); const labelsPerPage = Number(form.get("labelsPerPage"));
    if (!Number.isSafeInteger(quantity)) { setError("Kies een geldig aantal."); return; }
    setBusy(true); setError(null); try { const response = await fetch("/api/admin/qr/batches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantity, labelsPerPage }) }); const body = await response.json().catch(() => null) as { id?: string; error?: string } | null; if (!response.ok || !body?.id) { setError(body?.error ?? "Batch kon niet worden aangemaakt."); return; } window.location.assign(`/api/admin/qr/batches/${body.id}/pdf`); } catch { setError("De verbinding is mislukt."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2"><label className="text-sm text-ink-soft">Aantal labels<input name="quantity" type="number" min="1" max="500" defaultValue="100" className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-ink" /></label><fieldset className="text-sm text-ink-soft"><legend>Labels per A4</legend><label className="mt-2 mr-4 inline-flex gap-2"><input type="radio" name="labelsPerPage" value="10" />10</label><label className="inline-flex gap-2"><input type="radio" name="labelsPerPage" value="15" defaultChecked />15</label></fieldset>{error && <p className="sm:col-span-2 text-sm text-state-error">{error}</p>}<button disabled={busy} className="w-fit rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Genereren…" : "Genereren en PDF openen"}</button></form>;
}

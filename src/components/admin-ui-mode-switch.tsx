"use client";

import { useState } from "react";
import type { UiMode } from "@/lib/ui-mode";

export function AdminUiModeSwitch({ mode }: { mode: UiMode }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function change(nextMode: UiMode) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/ui-mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: nextMode }) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Weergave wijzigen is niet gelukt.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Weergave wijzigen is niet gelukt."); setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border border-line bg-card p-5"><h3 className="font-semibold text-ink">Website-weergave</h3><p className="mt-1 text-sm text-ink-soft">Alleen medewerkers kunnen tijdelijk tussen de nieuwe en klassieke interface wisselen.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || mode === "redesign"} onClick={() => change("redesign")} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Nieuwe weergave</button><button type="button" disabled={busy || mode === "initial"} onClick={() => change("initial")} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">Klassieke weergave</button></div>{message && <p role="alert" className="mt-3 text-sm text-state-error">{message}</p>}</section>;
}

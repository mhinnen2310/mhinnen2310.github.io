"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminReservationControls({ reservationId, releasable }: { reservationId: string; releasable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function release(releaseTo: "AVAILABLE" | "READY") {
    if (!releasable || !window.confirm(`Reservering vrijgeven en fiets naar ${releaseTo === "AVAILABLE" ? "beschikbaar" : "klaar"} zetten?`)) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "release", releaseTo }) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setError(body?.error ?? "Vrijgeven mislukt."); return; }
      router.refresh();
    } catch { setError("De verbinding is mislukt."); } finally { setBusy(false); }
  }
  if (!releasable) return <span className="text-xs text-ink-faint">Checkout-reservering: via betaling/order verwerken</span>;
  return <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => release("AVAILABLE")} className="rounded border border-brand-700 px-2 py-1 text-xs font-semibold text-brand-800 disabled:opacity-50">Vrijgeven</button><button disabled={busy} onClick={() => release("READY")} className="rounded border border-line px-2 py-1 text-xs text-ink-soft disabled:opacity-50">Naar klaar</button>{error && <p className="basis-full text-xs text-state-error">{error}</p>}</div>;
}

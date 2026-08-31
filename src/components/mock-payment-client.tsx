"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Mock provider checkout page (dev/E2E only).
 *
 * Each button POSTs { paymentId, status } to /api/webhooks/mock — the exact
 * same processing path a real provider webhook would take — and then
 * navigates to the result page, which polls the authoritative order state.
 */
export function MockPaymentClient({
  paymentId,
  orderNumber,
  statusToken,
}: {
  paymentId: string;
  orderNumber: string;
  statusToken: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(status: "paid" | "failed" | "canceled" | "expired") {
    if (busy) return;
    setBusy(status);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/mock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId, status }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; detail?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.detail ?? "De webhook kon niet worden verwerkt.");
      }
      window.location.href = `/betaaling/resultaat?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(statusToken)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Testomgeving · mock provider
      </p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-ink">
        Betaling voor bestelling {orderNumber}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Kies hoe deze testbetaling moet aflopen. Het signaal wordt door dezelfde webhook-pipeline
        verwerkt als in productie.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-2.5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => settle("paid")}
          className={cn(
            "rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60",
          )}
        >
          {busy === "paid" ? "Verwerken…" : "Betaling geslaagd (paid)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => settle("failed")}
          className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink-soft hover:bg-surface disabled:opacity-60"
        >
          {busy === "failed" ? "Verwerken…" : "Betaling mislukt (failed)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => settle("canceled")}
          className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink-soft hover:bg-surface disabled:opacity-60"
        >
          {busy === "canceled" ? "Verwerken…" : "Betaling geannuleerd (canceled)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => settle("expired")}
          className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink-soft hover:bg-surface disabled:opacity-60"
        >
          {busy === "expired" ? "Verwerken…" : "Betaling verlopen (expired)"}
        </button>
      </div>
    </div>
  );
}

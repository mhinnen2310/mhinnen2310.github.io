"use client";

import { useState } from "react";
import Link from "next/link";

interface LookupOrder {
  orderNumber: string;
  placedAt: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  totalCents: number;
  currency: string;
  lines: { name: string; quantity: number; lineTotalCents: number }[];
  invoiceNumber: string | null;
  invoiceId: string | null;
  invoiceAccessToken: string;
  warranties: { scope: string; description: string; endAt: string }[];
}

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Betaling in afwachting",
  PAID: "Betaald",
  FAILED: "Betaling mislukt",
  EXPIRED: "Betaling verlopen",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
  PARTIALLY_REFUNDED: "Deels terugbetaald",
};

const FULFILMENT_LABELS: Record<string, string> = {
  UNFULFILLED: "In behandeling",
  PREPARING: "In voorbereiding",
  READY_FOR_PICKUP: "Klaar om op te halen",
  OUT_FOR_DELIVERY: "Onderweg",
  FULFILLED: "Afgerond",
  CANCELLED: "Geannuleerd",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Guest order lookup (order number + e-mail — the e-mail must match, so
 * nothing is revealed without both). Rate-limited server-side.
 */
export function OrderLookupForm({ initialOrder }: { initialOrder?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrder ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<LookupOrder | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setOrder(null);

    const emailEl = ((e.currentTarget as HTMLFormElement).elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const email = emailEl.trim().toLowerCase();

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/lookup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => null)) as (LookupOrder & { error?: string }) | null;
      if (!res.ok || !body || (body as { error?: string }).error) {
        throw new Error((body as { error?: string })?.error ?? "Bestelling niet gevonden.");
      }
      setOrder(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          {error}
        </p>
      )}

      <form onSubmit={lookup} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ol-order" className="mb-1 block text-sm text-ink-soft">
            Bestelnummer
          </label>
          <input
            id="ol-order"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="DF-2026-000001"
            className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ol-email" className="mb-1 block text-sm text-ink-soft">
            E-mailadres bij de bestelling
          </label>
          <input
            id="ol-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || orderNumber.trim().length < 4}
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? "Zoeken…" : "Status opvragen"}
          </button>
        </div>
      </form>

      {order && (
        <div className="rounded-xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Bestelling {order.orderNumber}</p>
              <p className="text-xs text-ink-soft">Geplaatst op {fmtDate(order.placedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={
                  "rounded-full border px-2.5 py-0.5 font-medium " +
                  (order.paymentStatus === "PAID"
                    ? "border-brand-200 bg-brand-50 text-brand-800"
                    : order.paymentStatus === "PENDING"
                      ? "border-accent-100 bg-accent-50 text-accent-700"
                      : "border-[#ecd9d7] bg-[#f6e9e8] text-state-error")
                }
              >
                {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </span>
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-medium text-ink-soft">
                {FULFILMENT_LABELS[order.fulfilmentStatus] ?? order.fulfilmentStatus}
              </span>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5 text-sm">
            {order.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink-soft">
                  {l.quantity > 1 && <span className="mr-1 text-xs text-ink-faint">×{l.quantity}</span>}
                  {l.name}
                </span>
                <span className="font-medium text-ink">€ {(l.lineTotalCents / 100).toFixed(2)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
              <span>Totaal ({order.currency})</span>
              <span>€ {(order.totalCents / 100).toFixed(2)}</span>
            </li>
          </ul>

          {order.warranties.length > 0 && (
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
              <p className="font-semibold">Garantie bij deze verkoop</p>
              {order.warranties.map((w, i) => (
                <p key={i} className="mt-1">
                  {w.description} <span className="text-brand-600">(einde: {fmtDate(w.endAt)})</span>
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {order.invoiceId && order.invoiceAccessToken && (
              <a
                href={`/api/invoices/${order.invoiceId}/download?access=${encodeURIComponent(order.invoiceAccessToken)}`}
                className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink hover:bg-surface"
              >
                Factuur {order.invoiceNumber} (PDF)
              </a>
            )}
            <Link
              href={`/service?order=${encodeURIComponent(order.orderNumber)}`}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink hover:bg-surface"
            >
              Retour / service indienen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

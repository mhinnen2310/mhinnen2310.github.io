"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function cartChanged() {
  window.dispatchEvent(new Event("df:cart-changed"));
}

/**
 * Quantity controls + remove for a STOCK_ITEM cart line.
 *
 * UNIQUE_BIKE lines never get quantity controls (Invariant 2) — the parent
 * page simply does not render this component for bike lines. The server
 * re-validates stock and rejects impossible quantities.
 */
export function CartLineActions({
  lineId,
  kind,
  quantity,
  stockQuantity,
}: {
  lineId: string;
  kind: "UNIQUE_BIKE" | "STOCK_ITEM";
  quantity: number;
  stockQuantity: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  async function act(path: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "De winkelwagen kon niet worden bijgewerkt.");
      }
      if (path === "/api/cart/remove") setRemoved(true);
      cartChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  if (removed) {
    return (
      <p className="text-xs text-ink-faint" role="status">
        Verwijderd
      </p>
    );
  }

  if (kind === "UNIQUE_BIKE") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-faint">1 exemplaar — unieke fiets</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("/api/cart/remove", { lineId })}
          className="text-xs font-medium text-ink-soft underline hover:text-state-error"
        >
          Verwijderen
        </button>
      </div>
    );
  }

  const max = Math.max(quantity, stockQuantity);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center rounded-lg border border-line" role="group" aria-label="Hoeveelheid">
        <button
          type="button"
          onClick={() => act("/api/cart/set-quantity", { lineId, quantity: quantity - 1 })}
          disabled={busy || quantity <= 1}
          aria-label="Een minder"
          className="px-2.5 py-1 text-lg leading-none text-ink-soft hover:text-ink disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-7 text-center text-sm font-medium" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => act("/api/cart/set-quantity", { lineId, quantity: quantity + 1 })}
          disabled={busy || quantity >= max}
          aria-label="Een meer"
          className="px-2.5 py-1 text-lg leading-none text-ink-soft hover:text-ink disabled:opacity-40"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => act("/api/cart/remove", { lineId })}
        className={cn("text-xs font-medium underline hover:text-state-error", busy && "opacity-50")}
      >
        Verwijderen
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-state-error">
          {error}
        </p>
      )}
    </div>
  );
}

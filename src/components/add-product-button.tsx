"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function cartChanged() {
  window.dispatchEvent(new Event("df:cart-changed"));
}

/**
 * Add a STOCK_ITEM with an explicit quantity control (normal e-commerce
 * behaviour, unlike unique bikes).
 */
export function AddProductButton({
  productId,
  stockQuantity,
  size = "sm",
}: {
  productId: string;
  stockQuantity: number;
  size?: "sm" | "lg";
}) {
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const max = Math.max(1, stockQuantity);

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/cart/add-product", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Het product kon niet worden toegevoegd.");
      }
      setState("done");
      cartChanged();
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
      setState("error");
      setTimeout(() => {
        setState("idle");
        setError(null);
      }, 6000);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-2">
        <div className="flex items-center rounded-lg border border-line bg-card" role="group" aria-label="Hoeveelheid">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Minder"
            className="px-3 text-lg leading-none text-ink-soft hover:text-ink disabled:opacity-40"
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="min-w-8 text-center text-sm font-medium" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            aria-label="Meer"
            className="px-3 text-lg leading-none text-ink-soft hover:text-ink disabled:opacity-40"
            disabled={qty >= max}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={state === "busy"}
          className={cn(
            "rounded-lg bg-brand-700 font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-default disabled:opacity-90",
            size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm",
          )}
        >
          {state === "busy" && "Toevoegen…"}
          {state === "done" && "✓ Toegevoegd"}
          {state === "idle" && "In winkelwagen"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-state-error">
          {error}
        </p>
      )}
    </div>
  );
}

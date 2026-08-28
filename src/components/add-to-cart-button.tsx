"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function cartChanged() {
  window.dispatchEvent(new Event("df:cart-changed"));
}

/**
 * Add a UNIQUE bike to the cart (quantity is always 1 — the server enforces
 * this; the button simply never offers a quantity control).
 */
export function AddToCartButton({
  bikeId,
  label = "In winkelwagen",
  size = "sm",
}: {
  bikeId: string;
  label?: string;
  size?: "sm" | "lg";
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/cart/add-bike", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bikeId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "De fiets kon niet aan je winkelwagen worden toegevoegd.");
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
    <>
      <button
        type="button"
        onClick={add}
        disabled={state === "busy" || state === "done"}
        className={cn(
          "rounded-lg bg-brand-700 font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-default disabled:opacity-90",
          size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm",
          state === "done" && "bg-brand-600",
        )}
      >
        {state === "busy" && "Toevoegen…"}
        {state === "done" && "✓ In winkelwagen"}
        {state === "idle" && label}
      </button>
      {state === "error" && error && (
        <p role="alert" className="max-w-56 text-xs text-state-error">
          {error}
        </p>
      )}
    </>
  );
}

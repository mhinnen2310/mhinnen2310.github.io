"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminProductEditor({ product }: {
  product: { id: string; stockQuantity: number; salePriceCents: number; active: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const price = Number(String(form.get("priceEuro") ?? "").replace(",", "."));
    const stock = Number(form.get("stockQuantity"));
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Controleer prijs en voorraad.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salePriceCents: Math.round(price * 100), stockQuantity: stock, active: form.get("active") === "yes" }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Opslaan is niet gelukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-w-[360px] flex-wrap items-end gap-2">
      <label className="text-xs text-ink-soft">Prijs (€)
        <input name="priceEuro" type="number" min="0" step="0.01" defaultValue={(product.salePriceCents / 100).toFixed(2)} className="mt-1 block w-24 rounded-md border border-line px-2 py-1.5 text-sm" />
      </label>
      <label className="text-xs text-ink-soft">Voorraad
        <input name="stockQuantity" type="number" min="0" step="1" defaultValue={product.stockQuantity} className="mt-1 block w-20 rounded-md border border-line px-2 py-1.5 text-sm" />
      </label>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink-soft">
        <input name="active" value="yes" type="checkbox" defaultChecked={product.active} /> Actief
      </label>
      <button type="submit" disabled={busy} className="mb-0.5 rounded-md border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60">
        {busy ? "Opslaan…" : "Opslaan"}
      </button>
      {error && <p role="alert" className="w-full text-xs text-state-error">{error}</p>}
    </form>
  );
}

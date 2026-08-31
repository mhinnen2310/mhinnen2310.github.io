"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminProduct = {
  id: string;
  sku: string;
  title: string;
  category: string | null;
  description: string | null;
  purchasePriceCents: number | null;
  salePriceCents: number;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
};

function cents(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function integer(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !/^\d+$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function ErrorNotice({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-sm text-state-error">{error}</p> : null;
}

export function AdminProductCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const salePriceCents = cents(form.get("salePriceEuro"));
    const purchasePriceCents = cents(form.get("purchasePriceEuro"));
    const stockQuantity = integer(form.get("stockQuantity"));
    const lowStockThreshold = integer(form.get("lowStockThreshold"));
    if (salePriceCents === null || stockQuantity === null || lowStockThreshold === null || (form.get("purchasePriceEuro") && purchasePriceCents === null)) {
      setError("Controleer prijs en voorraad.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: form.get("sku"),
          title: form.get("title"),
          category: form.get("category"),
          description: form.get("description"),
          purchasePriceCents,
          salePriceCents,
          stockQuantity,
          lowStockThreshold,
          active: form.get("active") === "yes",
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Het accessoire kon niet worden aangemaakt.");
        return;
      }
      event.currentTarget.reset();
      setNotice("Accessoire en openingsvoorraad zijn opgeslagen.");
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <h3 className="font-semibold text-ink">Accessoire toevoegen</h3>
      <p className="mt-1 text-sm text-ink-soft">De openingsvoorraad wordt direct als voorraadmutatie vastgelegd.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">SKU<input name="sku" required maxLength={80} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Naam<input name="title" required maxLength={180} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Categorie<input name="category" maxLength={100} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Inkoopprijs (€)<input name="purchasePriceEuro" type="number" min="0" step="0.01" className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Verkoopprijs (€)<input name="salePriceEuro" type="number" min="0" step="0.01" required className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Openingsvoorraad<input name="stockQuantity" type="number" min="0" step="1" required defaultValue="0" className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="text-sm text-ink-soft">Waarschuwing lage voorraad<input name="lowStockThreshold" type="number" min="0" step="1" required defaultValue="3" className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-soft"><input name="active" value="yes" type="checkbox" defaultChecked /> Direct zichtbaar in de winkel</label>
        <label className="sm:col-span-2 text-sm text-ink-soft">Beschrijving<textarea name="description" rows={3} maxLength={12_000} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-ink" /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">{busy ? "Opslaan…" : "Accessoire opslaan"}</button>{notice && <p role="status" className="text-sm text-brand-800">{notice}</p>}</div>
        <div className="sm:col-span-2"><ErrorNotice error={error} /></div>
      </form>
    </section>
  );
}

export function AdminProductEditor({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const salePriceCents = cents(form.get("salePriceEuro"));
    const purchasePriceCents = cents(form.get("purchasePriceEuro"));
    const stockQuantity = integer(form.get("stockQuantity"));
    const lowStockThreshold = integer(form.get("lowStockThreshold"));
    if (salePriceCents === null || stockQuantity === null || lowStockThreshold === null || (form.get("purchasePriceEuro") && purchasePriceCents === null)) {
      setError("Controleer prijs en voorraad.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: form.get("sku"), title: form.get("title"), category: form.get("category"), description: form.get("description"),
          purchasePriceCents, salePriceCents, stockQuantity, lowStockThreshold, active: form.get("active") === "yes",
        }),
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
    <details className="min-w-[360px]">
      <summary className="cursor-pointer text-xs font-semibold text-brand-800 hover:underline">Bewerken</summary>
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-ink-soft">SKU<input name="sku" required defaultValue={product.sku} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Naam<input name="title" required defaultValue={product.title} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Categorie<input name="category" defaultValue={product.category ?? ""} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Inkoop (€)<input name="purchasePriceEuro" type="number" min="0" step="0.01" defaultValue={product.purchasePriceCents != null ? (product.purchasePriceCents / 100).toFixed(2) : ""} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Verkoop (€)<input name="salePriceEuro" type="number" min="0" step="0.01" defaultValue={(product.salePriceCents / 100).toFixed(2)} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Voorraad<input name="stockQuantity" type="number" min="0" step="1" defaultValue={product.stockQuantity} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-ink-soft">Lage grens<input name="lowStockThreshold" type="number" min="0" step="1" defaultValue={product.lowStockThreshold} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <label className="flex items-center gap-1.5 self-end pb-1.5 text-xs text-ink-soft"><input name="active" value="yes" type="checkbox" defaultChecked={product.active} /> Actief</label>
        <label className="sm:col-span-2 text-xs text-ink-soft">Beschrijving<textarea name="description" rows={2} defaultValue={product.description ?? ""} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5 text-sm" /></label>
        <div className="sm:col-span-2 flex items-center gap-3"><button type="submit" disabled={busy} className="rounded-md border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60">{busy ? "Opslaan…" : "Opslaan"}</button><ErrorNotice error={error} /></div>
      </form>
    </details>
  );
}

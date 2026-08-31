"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Customer = { id: string; name: string | null; email: string };
export function AdminOrderCustomerLink({
  orderId,
  currentUserId,
  customers,
}: {
  orderId: string;
  currentUserId: string | null;
  customers: Customer[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/customer`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: form.get("userId") || null }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.error ?? "Klant koppelen is mislukt.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Klant koppelen is mislukt.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
      <select
        name="userId"
        defaultValue={currentUserId ?? ""}
        className="min-w-64 rounded-md border border-line bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Geen klantaccount</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name ?? "Naam ontbreekt"} · {customer.email}
          </option>
        ))}
      </select>
      <button
        disabled={busy}
        className="rounded-md border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-800 disabled:opacity-60"
      >
        {busy ? "Koppelen…" : "Klant koppelen"}
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-state-error">
          {error}
        </p>
      )}
    </form>
  );
}

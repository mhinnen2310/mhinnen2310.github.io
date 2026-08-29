"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminStatusEntity = "appointment" | "serviceRequest" | "contactMessage" | "orderFulfilment";

export function AdminStatusControl({
  entity,
  id,
  value,
  options,
}: {
  entity: AdminStatusEntity;
  id: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
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
      const response = await fetch("/api/admin/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, id, status: form.get("status") }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Status opslaan is niet gelukt.");
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
    <form onSubmit={submit} className="space-y-1">
      <div className="flex min-w-56 gap-2">
        <select name="status" defaultValue={value} aria-label="Status" className="min-w-0 flex-1 rounded-md border border-line bg-card px-2 py-1.5 text-xs text-ink">
          {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
        <button type="submit" disabled={busy} className="rounded-md border border-brand-700 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60">
          {busy ? "…" : "Opslaan"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-state-error">{error}</p>}
    </form>
  );
}

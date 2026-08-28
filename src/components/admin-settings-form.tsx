"use client";

import { useState } from "react";

type AdminSettings = {
  companyName: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postcode: string | null;
  city: string | null;
  kvkNumber: string | null;
  vatId: string | null;
  iban: string | null;
  aboutText: string | null;
  newsletterEnabled: boolean;
};

export function AdminSettingsForm({ settings }: { settings: AdminSettings }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: form.get("companyName"), email: form.get("email"), phone: form.get("phone"),
          addressLine: form.get("addressLine"), postcode: form.get("postcode"), city: form.get("city"),
          kvkNumber: form.get("kvkNumber"), vatId: form.get("vatId"), iban: form.get("iban"),
          aboutText: form.get("aboutText"), newsletterEnabled: form.get("newsletterEnabled") === "yes",
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Instellingen opslaan is niet gelukt.");
        return;
      }
      setNotice("De bedrijfsinstellingen zijn opgeslagen.");
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
  const fields: Array<[string, string, string | null]> = [
    ["companyName", "Bedrijfsnaam", settings.companyName], ["email", "E-mail", settings.email],
    ["phone", "Telefoon", settings.phone], ["addressLine", "Adres", settings.addressLine],
    ["postcode", "Postcode", settings.postcode], ["city", "Plaats", settings.city],
    ["kvkNumber", "KvK-nummer", settings.kvkNumber], ["vatId", "Btw-id", settings.vatId],
    ["iban", "IBAN", settings.iban],
  ];
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-state-error">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([name, label, value]) => (
          <label key={name} className="text-sm text-ink-soft">{label}
            <input name={name} defaultValue={value ?? ""} required={name === "companyName"} className={inputClass} />
          </label>
        ))}
      </div>
      <label className="block text-sm text-ink-soft">Over ons
        <textarea name="aboutText" rows={8} defaultValue={settings.aboutText ?? ""} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input name="newsletterEnabled" value="yes" type="checkbox" defaultChecked={settings.newsletterEnabled} /> Nieuwsbriefinschrijving tonen
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {busy ? "Opslaan…" : "Instellingen opslaan"}
      </button>
    </form>
  );
}

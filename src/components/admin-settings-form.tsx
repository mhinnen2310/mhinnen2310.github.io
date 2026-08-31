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
  openingHours: Array<{ days: string; hours: string }>;
  announcement: {
    enabled: boolean;
    text: string;
    link: string | null;
    startAt: string | null;
    endAt: string | null;
  };
  homepage: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    intro: string | null;
    showRecentlyAdded: boolean;
    showWhyUs: boolean;
    showHowItWorks: boolean;
    primaryCta: string | null;
    secondaryCta: string | null;
  };
  delivery: {
    title: string | null;
    description: string | null;
    options: string[];
  };
  warranty: {
    title: string | null;
    description: string | null;
  };
  tax: {
    basis: "incl" | "excl";
    bikeScheme: "MARGIN" | "STANDARD";
    bikeRate: number;
    accessoryRate: number;
    requiresReview: boolean;
  };
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
          companyName: form.get("companyName"),
          email: form.get("email"),
          phone: form.get("phone"),
          addressLine: form.get("addressLine"),
          postcode: form.get("postcode"),
          city: form.get("city"),
          kvkNumber: form.get("kvkNumber"),
          vatId: form.get("vatId"),
          iban: form.get("iban"),
          aboutText: form.get("aboutText"),
          openingHoursText: form.get("openingHoursText"),
          newsletterEnabled: form.get("newsletterEnabled") === "yes",
          announcementEnabled: form.get("announcementEnabled") === "yes",
          announcementText: form.get("announcementText"),
          announcementLink: form.get("announcementLink"),
          announcementStartAt: form.get("announcementStartAt"),
          announcementEndAt: form.get("announcementEndAt"),
          heroTitle: form.get("heroTitle"),
          heroSubtitle: form.get("heroSubtitle"),
          homepageIntro: form.get("homepageIntro"),
          primaryCta: form.get("primaryCta"),
          secondaryCta: form.get("secondaryCta"),
          showRecentlyAdded: form.get("showRecentlyAdded") === "yes",
          showWhyUs: form.get("showWhyUs") === "yes",
          showHowItWorks: form.get("showHowItWorks") === "yes",
          deliveryTitle: form.get("deliveryTitle"),
          deliveryDescription: form.get("deliveryDescription"),
          deliveryOptions: form.get("deliveryOptions"),
          warrantyTitle: form.get("warrantyTitle"),
          warrantyDescription: form.get("warrantyDescription"),
          taxBasis: form.get("taxBasis"),
          bikeScheme: form.get("bikeScheme"),
          bikeRate: form.get("bikeRate"),
          accessoryRate: form.get("accessoryRate"),
          taxRequiresReview: form.get("taxRequiresReview") === "yes",
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
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

  const inputClass =
    "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
  const fields: Array<[string, string, string | null]> = [
    ["companyName", "Bedrijfsnaam", settings.companyName],
    ["email", "E-mail", settings.email],
    ["phone", "Telefoon", settings.phone],
    ["addressLine", "Adres", settings.addressLine],
    ["postcode", "Postcode", settings.postcode],
    ["city", "Plaats", settings.city],
    ["kvkNumber", "KvK-nummer", settings.kvkNumber],
    ["vatId", "Btw-id", settings.vatId],
    ["iban", "IBAN", settings.iban],
  ];
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-state-error"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([name, label, value]) => (
          <label key={name} className="text-sm text-ink-soft">
            {label}
            <input
              name={name}
              defaultValue={value ?? ""}
              required={name === "companyName"}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <label className="block text-sm text-ink-soft">
        Over ons
        <textarea
          name="aboutText"
          rows={8}
          defaultValue={settings.aboutText ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm text-ink-soft">
        Openingstijden (één regel per periode, formaat: dagen | uren)
        <textarea
          name="openingHoursText"
          rows={4}
          defaultValue={settings.openingHours
            .map((item) => `${item.days} | ${item.hours}`)
            .join("\n")}
          placeholder="ma t/m vr | 09:00–17:00\nzaterdag | 09:00–16:00"
          className={inputClass}
        />
      </label>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">
          Website-melding
        </legend>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <input
            name="announcementEnabled"
            value="yes"
            type="checkbox"
            defaultChecked={settings.announcement.enabled}
          />{" "}
          Melding live tonen
        </label>
        <label className="mt-3 block text-sm text-ink-soft">
          Tekst
          <textarea
            name="announcementText"
            rows={3}
            defaultValue={settings.announcement.text}
            className={inputClass}
          />
        </label>
        <label className="mt-3 block text-sm text-ink-soft">
          Link (optioneel, intern pad)
          <input
            name="announcementLink"
            defaultValue={settings.announcement.link ?? ""}
            placeholder="/fietsen"
            className={inputClass}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-soft">
            Startdatum
            <input
              name="announcementStartAt"
              type="date"
              defaultValue={settings.announcement.startAt?.slice(0, 10) ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Einddatum
            <input
              name="announcementEndAt"
              type="date"
              defaultValue={settings.announcement.endAt?.slice(0, 10) ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Btw & margeregeling</legend>
        <p className="mt-1 text-xs text-ink-faint">Deze instelling wordt vastgelegd op iedere nieuwe order. Laat de margeregeling door je boekhouder bevestigen.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-ink-soft">Fietsregeling<select name="bikeScheme" defaultValue={settings.tax.bikeScheme} className={inputClass}><option value="MARGIN">Margeregeling (tweedehands fietsen)</option><option value="STANDARD">Normale btw</option></select></label>
          <label className="text-sm text-ink-soft">Prijsbasis<select name="taxBasis" defaultValue={settings.tax.basis} className={inputClass}><option value="incl">Verkoopprijzen inclusief btw</option><option value="excl">Verkoopprijzen exclusief btw</option></select></label>
          <label className="text-sm text-ink-soft">Btw-percentage fietsen<input name="bikeRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.tax.bikeRate} className={inputClass} /></label>
          <label className="text-sm text-ink-soft">Btw-percentage accessoires<input name="accessoryRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.tax.accessoryRate} className={inputClass} /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft"><input name="taxRequiresReview" value="yes" type="checkbox" defaultChecked={settings.tax.requiresReview} /> Boekhoudkundige controle markeren</label>
      </fieldset>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">
          Homepage
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-ink-soft">
            Hero-titel
            <input
              name="heroTitle"
              defaultValue={settings.homepage.heroTitle ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Hero-subtitel
            <input
              name="heroSubtitle"
              defaultValue={settings.homepage.heroSubtitle ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Primaire CTA
            <input
              name="primaryCta"
              defaultValue={settings.homepage.primaryCta ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Secundaire CTA
            <input
              name="secondaryCta"
              defaultValue={settings.homepage.secondaryCta ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-ink-soft">
          Intro
          <textarea
            name="homepageIntro"
            rows={4}
            defaultValue={settings.homepage.intro ?? ""}
            className={inputClass}
          />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["showRecentlyAdded", "Nieuwe fietsen"],
              ["showWhyUs", "Waarom Demi Fietsen"],
              ["showHowItWorks", "Zo werkt het"],
            ] as const
          ).map(([name, label]) => (
            <label
              key={name}
              className="flex items-center gap-2 text-sm text-ink-soft"
            >
              <input
                name={name}
                value="yes"
                type="checkbox"
                defaultChecked={settings.homepage[name]}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">
          Bezorging & garantie
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-ink-soft">
            Bezorgingstitel
            <input
              name="deliveryTitle"
              defaultValue={settings.delivery.title ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Garantietitel
            <input
              name="warrantyTitle"
              defaultValue={settings.warranty.title ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-ink-soft">
          Bezorginguitleg
          <textarea
            name="deliveryDescription"
            rows={3}
            defaultValue={settings.delivery.description ?? ""}
            className={inputClass}
          />
        </label>
        <label className="mt-3 block text-sm text-ink-soft">
          Bezorgopties (één per regel)
          <textarea
            name="deliveryOptions"
            rows={3}
            defaultValue={settings.delivery.options.join("\n")}
            className={inputClass}
          />
        </label>
        <label className="mt-3 block text-sm text-ink-soft">
          Garantie-uitleg
          <textarea
            name="warrantyDescription"
            rows={4}
            defaultValue={settings.warranty.description ?? ""}
            className={inputClass}
          />
        </label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          name="newsletterEnabled"
          value="yes"
          type="checkbox"
          defaultChecked={settings.newsletterEnabled}
        />{" "}
        Nieuwsbriefinschrijving tonen
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {busy ? "Opslaan…" : "Instellingen opslaan"}
      </button>
    </form>
  );
}

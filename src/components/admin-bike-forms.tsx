"use client";

import { useState } from "react";
import Image from "next/image";
import { mediaWidthUrl } from "@/lib/media";

type AdminBike = {
  id: string;
  inventoryCode: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  priceCents: number;
  status: "INTAKE" | "WORKSHOP" | "READY" | "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED";
  bikeType: string | null;
  colour: string | null;
  conditionGrade: string | null;
  conditionDescription: string | null;
  repairSummary: string | null;
  description: string | null;
  images: Array<{ id: string; storageKey: string; width: number; height: number; isCover: boolean }>;
};

export type BikeFormSuggestions = {
  brands: string[];
  modelsByBrand: Record<string, string[]>;
  bikeTypes: string[];
  colours: string[];
  conditions: string[];
};

const statusOptions: Array<{ value: AdminBike["status"]; label: string }> = [
  { value: "INTAKE", label: "Intake" },
  { value: "WORKSHOP", label: "Werkplaats" },
  { value: "READY", label: "Klaar" },
  { value: "AVAILABLE", label: "Beschikbaar (publiceren)" },
  { value: "ARCHIVED", label: "Gearchiveerd" },
];

function euroToCents(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

function Field({ label, name, defaultValue, required = false, type = "text" }: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block text-sm text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-3 py-2 text-sm text-state-error">{message}</p>;
}

function imageFiles(form: FormData): File[] {
  return form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
}

async function uploadBikeImages(bikeId: string, files: File[]): Promise<{ uploaded: number; error: string | null }> {
  let uploaded = 0;
  for (const file of files) {
    const payload = new FormData();
    payload.set("image", file);
    const response = await fetch(`/api/admin/bikes/${bikeId}/images`, { method: "POST", body: payload });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) return { uploaded, error: result?.error ?? `Foto ${file.name} kon niet worden geüpload.` };
    uploaded++;
  }
  return { uploaded, error: null };
}

export function AdminBikeCreateForm({ suggestions }: { suggestions: BikeFormSuggestions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBikeId, setCreatedBikeId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);

  function updateIdentity(nextBrand: string, nextModel: string) {
    if (!titleEdited) setTitle([nextBrand, nextModel].filter(Boolean).join(" "));
  }

  const smartInputClass = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
  const modelSuggestions = suggestions.modelsByBrand[brand] ?? [...new Set(Object.values(suggestions.modelsByBrand).flat())].sort((a, b) => a.localeCompare(b, "nl"));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const priceCents = euroToCents(form.get("priceEuro"));
    const files = imageFiles(form);
    if (priceCents === null) {
      setError("Vul een geldige vraagprijs in.");
      setBusy(false);
      return;
    }
    if (files.length > 12) {
      setError("Je kunt maximaal 12 foto’s tegelijk toevoegen.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/bikes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inventoryCode: form.get("inventoryCode"),
          title: form.get("title"),
          brand: form.get("brand"),
          model: form.get("model"),
          priceCents,
          bikeType: form.get("bikeType"),
          colour: form.get("colour"),
          conditionGrade: form.get("conditionGrade"),
          description: form.get("description"),
        }),
      });
      const result = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError(result?.error ?? "De fiets kon niet worden aangemaakt.");
        return;
      }
      setCreatedBikeId(result.id);
      const upload = await uploadBikeImages(result.id, files);
      if (upload.error) {
        setError(`De fiets is als concept aangemaakt. ${upload.uploaded} van ${files.length} foto’s zijn opgeslagen. ${upload.error}`);
        return;
      }
      if (form.get("publishNow") === "yes") {
        const publishResponse = await fetch(`/api/admin/bikes/${result.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "status", status: "AVAILABLE" }),
        });
        const publishResult = (await publishResponse.json().catch(() => null)) as { error?: string } | null;
        if (!publishResponse.ok) {
          setError(`De fiets en foto’s zijn opgeslagen als concept. Publiceren lukte nog niet: ${publishResult?.error ?? "controleer de publicatiecheck."}`);
          return;
        }
      }
      window.location.assign(`/admin/fietsen/${result.id}`);
    } catch {
      setError("De verbinding is mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorNotice message={error} />
      {createdBikeId && (
        <a href={`/admin/fietsen/${createdBikeId}`} className="inline-block text-sm font-semibold text-brand-700 underline">
          Open het opgeslagen concept
        </a>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Voorraadcode" name="inventoryCode" required />
        <Field label="Vraagprijs (€)" name="priceEuro" type="number" required />
      </div>
      <label className="block text-sm text-ink-soft">Titel
        <div className="mt-1 flex gap-2"><input name="title" required value={title} onChange={(event) => { setTitleEdited(true); setTitle(event.target.value); }} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /><button type="button" onClick={() => { setTitleEdited(false); setTitle([brand, model].filter(Boolean).join(" ")); }} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink">Automatisch</button></div>
        <span className="mt-1 block text-xs text-ink-faint">Wordt automatisch opgebouwd uit merk en model; je kunt hem altijd aanpassen.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink-soft">Merk<input name="brand" list="bike-brands" required value={brand} onChange={(event) => { setBrand(event.target.value); updateIdentity(event.target.value, model); }} className={smartInputClass} /><datalist id="bike-brands">{suggestions.brands.map((value) => <option key={value} value={value} />)}</datalist></label>
        <label className="block text-sm text-ink-soft">Model<input name="model" list="bike-models" required value={model} onChange={(event) => { setModel(event.target.value); updateIdentity(brand, event.target.value); }} className={smartInputClass} /><datalist id="bike-models">{modelSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label>
        <label className="block text-sm text-ink-soft">Fietstype<input name="bikeType" list="bike-types" className={smartInputClass} /><datalist id="bike-types">{suggestions.bikeTypes.map((value) => <option key={value} value={value} />)}</datalist></label>
        <label className="block text-sm text-ink-soft">Kleur<input name="colour" list="bike-colours" className={smartInputClass} /><datalist id="bike-colours">{suggestions.colours.map((value) => <option key={value} value={value} />)}</datalist></label>
      </div>
      <label className="block text-sm text-ink-soft">Conditie<input name="conditionGrade" list="bike-conditions" className={smartInputClass} /><datalist id="bike-conditions">{suggestions.conditions.map((value) => <option key={value} value={value} />)}</datalist></label>
      <label className="block text-sm text-ink-soft">
        Advertentietekst
        <textarea name="description" rows={7} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" />
      </label>
      <fieldset className="rounded-xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Foto&apos;s</legend>
        <p className="mb-3 text-xs text-ink-faint">Selecteer maximaal 12 foto&apos;s. De eerste foto wordt automatisch de omslagfoto.</p>
        <input
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          onChange={(event) => setSelectedImages(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
          className="block w-full text-sm text-ink-soft"
        />
        {selectedImages.length > 0 && (
          <p className="mt-2 text-xs text-ink-soft">{selectedImages.length} geselecteerd: {selectedImages.join(", ")}</p>
        )}
      </fieldset>
      <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm text-ink-soft">
        <input name="publishNow" value="yes" type="checkbox" className="mt-0.5" />
        <span>Direct publiceren als prijs, titel, beschrijving en minimaal één foto compleet zijn.</span>
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70">
        {busy ? "Fiets en foto’s opslaan…" : "Advertentie opslaan"}
      </button>
    </form>
  );
}

export function AdminBikeEditor({ bike }: { bike: AdminBike }) {
  const [busy, setBusy] = useState<"save" | "status" | "image" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const priceCents = euroToCents(form.get("priceEuro"));
    if (priceCents === null) {
      setError("Vul een geldige vraagprijs in.");
      setBusy(null);
      return;
    }
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: form.get("title"),
          brand: form.get("brand"),
          model: form.get("model"),
          slug: form.get("slug"),
          priceCents,
          bikeType: form.get("bikeType"),
          colour: form.get("colour"),
          conditionGrade: form.get("conditionGrade"),
          conditionDescription: form.get("conditionDescription"),
          repairSummary: form.get("repairSummary"),
          description: form.get("description"),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Opslaan is niet gelukt.");
        return;
      }
      setNotice("De gegevens zijn opgeslagen.");
    } catch {
      setError("De verbinding is mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const status = form.get("status");
    setBusy("status");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "De status kon niet worden gewijzigd.");
        return;
      }
      window.location.reload();
    } catch {
      setError("De verbinding is mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const files = imageFiles(form);
    if (files.length === 0) {
      setError("Kies eerst één of meer afbeeldingen.");
      return;
    }
    if (files.length > 12) {
      setError("Je kunt maximaal 12 foto’s tegelijk toevoegen.");
      return;
    }
    setBusy("image");
    setError(null);
    setNotice(null);
    try {
      const upload = await uploadBikeImages(bike.id, files);
      if (upload.error) {
        setError(`${upload.uploaded} van ${files.length} foto’s zijn opgeslagen. ${upload.error}`);
        return;
      }
      window.location.reload();
    } catch {
      setError("De verbinding is mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{bike.inventoryCode}</p>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{bike.title}</h2>
        </div>
        <form onSubmit={changeStatus} className="flex items-end gap-2">
          <label className="text-sm text-ink-soft">
            Status
            <select name="status" defaultValue={bike.status} className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink">
              {!statusOptions.some((option) => option.value === bike.status) && (
                <option value={bike.status} disabled>
                  {bike.status === "SOLD" ? "Verkocht (via verkoopdossier)" : "Gereserveerd (via reserveringslifecycle)"}
                </option>
              )}
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy !== null} className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-70">
            {busy === "status" ? "Wijzigen…" : "Status wijzigen"}
          </button>
        </form>
      </div>

      <div className="mt-5 space-y-3">
        <ErrorNotice message={error} />
        {notice && <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">{notice}</p>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={save} className="space-y-4 rounded-xl border border-line bg-card p-5 sm:p-6">
          <h3 className="font-semibold text-ink">Basisgegevens</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titel" name="title" defaultValue={bike.title} required />
            <Field label="Slug" name="slug" defaultValue={bike.slug} required />
            <Field label="Merk" name="brand" defaultValue={bike.brand} required />
            <Field label="Model" name="model" defaultValue={bike.model} required />
            <Field label="Vraagprijs (€)" name="priceEuro" defaultValue={(bike.priceCents / 100).toFixed(2)} type="number" required />
            <Field label="Fietstype" name="bikeType" defaultValue={bike.bikeType} />
            <Field label="Kleur" name="colour" defaultValue={bike.colour} />
            <Field label="Conditie" name="conditionGrade" defaultValue={bike.conditionGrade} />
          </div>
          <label className="block text-sm text-ink-soft">
            Conditiebeschrijving
            <textarea name="conditionDescription" defaultValue={bike.conditionDescription ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" />
          </label>
          <label className="block text-sm text-ink-soft">
            Uitgevoerde reparaties
            <textarea name="repairSummary" defaultValue={bike.repairSummary ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" />
          </label>
          <label className="block text-sm text-ink-soft">
            Winkelbeschrijving
            <textarea name="description" defaultValue={bike.description ?? ""} rows={8} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" />
          </label>
          <button type="submit" disabled={busy !== null} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70">
            {busy === "save" ? "Opslaan…" : "Opslaan"}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-card p-5">
            <h3 className="font-semibold text-ink">Foto&apos;s</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">Publiceren vereist minimaal één foto. De eerste foto wordt de omslagfoto.</p>
            <form onSubmit={uploadImage} className="mt-4 space-y-3">
              <input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="block w-full text-sm text-ink-soft" />
              <button type="submit" disabled={busy !== null} className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-70">
                {busy === "image" ? "Uploaden…" : "Foto’s uploaden"}
              </button>
            </form>
            {bike.images.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-2" aria-label="Geüploade foto&apos;s">
                {bike.images.map((image, index) => (
                  <li key={image.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                    <Image
                      src={mediaWidthUrl(image.storageKey, 256)}
                      alt={`Fietsafbeelding ${index + 1}`}
                      width={Math.max(1, image.width)}
                      height={Math.max(1, image.height)}
                      unoptimized
                      className="aspect-square h-auto w-full object-cover"
                    />
                    <p className="px-2 py-1 text-xs text-ink-faint">{image.isCover ? "Omslagfoto" : `Foto ${index + 1}`}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-ink-soft">Nog geen foto&apos;s.</p>}
          </section>
          <section className="rounded-xl border border-line bg-card p-5 text-sm text-ink-soft">
            <h3 className="font-semibold text-ink">Publicatiecheck</h3>
            <p className="mt-1 leading-relaxed">Voor &lsquo;Beschikbaar&rsquo; zijn een positieve vraagprijs, minstens één foto, titel en beschrijving nodig. De server controleert dit opnieuw bij de statuswijziging.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

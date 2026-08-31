"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mediaWidthUrl } from "@/lib/media";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { BatteryDossierPanel, BatteryLabelPanel, BikeIntakePanel, BikeWorkshopPanel } from "./admin-bike-p1b-panels";

type BikeStatus = "INTAKE" | "WORKSHOP" | "READY" | "AVAILABLE" | "RESERVED" | "SALE_PENDING" | "SOLD" | "ARCHIVED";

type BikeImage = { id: string; storageKey: string; width: number; height: number; isCover: boolean; isInternal: boolean };
type InspectionResult = "PASS" | "ATTENTION" | "FAIL" | "NOT_APPLICABLE";
type ServiceTask = { id: string; checklistKey: string | null; inspectionResult: InspectionResult | null; description: string; partName: string | null; partCostCents: number | null; quantity: number; labourMinutes: number | null; labourCostCents: number | null; photoKeys: string[]; doneDate: Date | null; internalNotes: string | null; completed: boolean; createdAt: Date; completedBy: { name: string | null; email: string } | null };
type PriceHistory = { id: string; oldPriceCents: number; newPriceCents: number; changedBy: string | null; createdAt: Date };
type AuditEvent = { id: string; action: string; meta: string | null; createdAt: Date; actor: string };

type AdminBike = {
  id: string; inventoryCode: string; slug: string; title: string; brand: string; model: string; variant: string | null; modelYear: number | null;
  bikeType: string | null; isElectric: boolean; frameStyle: string | null; genderStyle: string | null; colour: string | null;
  frameSizeCm: number | null; wheelSizeInches: number | null; gears: number | null; assistanceLevels: number | null; brakeInfo: string | null; drivetrainInfo: string | null;
  motorManufacturer: string | null; motorModel: string | null; motorPosition: string | null; motorDescription: string | null; nominalVoltage: number | null; walkAssist: boolean | null; electricalNotes: string | null;
  batteryType: string | null; batteryManufacturer: string | null; batteryModel: string | null; batteryVoltage: number | null; batteryAh: number | null; batteryWh: number | null; batteryMeasuredAh: number | null; batteryMeasuredWh: number | null; batterySohPercent: number | null; batteryTestDate: Date | null; batteryTestMethod: string | null; batteryCycleCount: number | null; batteryLabelPhotoKey: string | null; batteryCondition: string | null; batteryReconditioned: boolean | null; batteryRevisionDate: Date | null; rangeMinKm: number | null; rangeMaxKm: number | null; batterySerialRef: string | null; batteryWarrantyMonths: number | null; batteryNotes: string | null;
  conditionGrade: string | null; conditionDescription: string | null; cosmeticDefects: string | null; technicalDefects: string | null; repairSummary: string | null; description: string | null; features: string[];
  priceCents: number; previousPriceCents: number | null; saleLabel: string | null;
  acquisitionCostCents: number | null; acquisitionDate: Date | null; acquisitionSource: string | null; partsCostCents: number; repairCostCents: number; otherCostCents: number; labourMinutes: number | null; labourNotes: string | null;
  frameSerialRef: string | null; supplierDetails: string | null; storageLocation: string | null; workshopNotes: string | null; internalNotes: string | null;
  status: BikeStatus; publishedAt: Date | null; soldAt: Date | null; soldOrderNumber: string | null; realisedSalePriceCents: number | null; createdAt: Date;
  images: BikeImage[]; serviceTasks: ServiceTask[]; priceHistory: PriceHistory[];
  intakeRecord: { frameSerialPresent: boolean; keysPresent: boolean; chargerPresent: boolean; batteryPresent: boolean; defectsAssessed: boolean; knownDefects: string | null; theftCheckCompleted: boolean; theftCheckDate: Date | null; theftCheckResult: string | null } | null;
  currentBattery: { id: string; assetCode: string; status: string; manufacturer: string | null; model: string | null; serialNumber: string | null; nominalWh: number | null } | null;
};

type Margin = { totalCostCents: number; expectedGrossMarginCents: number | null; expectedMarginPercent: number | null; realisedSalePriceCents: number | null; grossMarginCents: number | null; marginPercent: number | null };

export type BikeFormSuggestions = { brands: string[]; modelsByBrand: Record<string, string[]>; bikeTypes: string[]; colours: string[]; conditions: string[] };

const FEATURES = [
  ["charger", "Oplader"], ["lock", "Fietsenslot"], ["lights", "Werkende verlichting"], ["frontSuspension", "Vorkvering"],
  ["suspensionSeatpost", "Geveerde zadelbuis"], ["frontRack", "Voorrek"], ["rearRack", "Achterrek"], ["panniers", "Tassen"],
  ["goodTyres", "Goede banden"], ["walkAssist", "Loopassistent"], ["bell", "Bel"], ["bottleHolder", "Fleshouder"], ["fenders", "Spatborden"], ["stand", "Standaard"],
] as const;

const editableStatuses: Array<[BikeStatus, string]> = [["INTAKE", "Intake"], ["WORKSHOP", "Werkplaats"], ["READY", "Klaar"], ["AVAILABLE", "Beschikbaar (publiceren)"], ["ARCHIVED", "Gearchiveerd"]];

type IntakeTab = "overview" | "specs" | "battery" | "condition" | "costs" | "sale";
const intakeTabs: Array<[IntakeTab, string, string]> = [
  ["overview", "Overzicht", "Basis en intakecontrole"],
  ["specs", "Specificaties", "Maatvoering en uitrusting"],
  ["battery", "Accu", "Elektrisch systeem en asset"],
  ["condition", "Conditie", "Staat en notities"],
  ["costs", "Kosten", "Inkoop en marge"],
  ["sale", "Verkoop", "Prijs en advertentie"],
];

function euroToCents(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

function optionalInteger(form: FormData, name: string): number | null | "invalid" {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : "invalid";
}

function optionalDecimal(form: FormData, name: string): number | null | "invalid" {
  const raw = String(form.get(name) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : "invalid";
}

function optionalBoolean(form: FormData, name: string): boolean | null {
  const value = String(form.get(name) ?? "");
  return value === "ja" ? true : value === "nee" ? false : null;
}

function imageFiles(form: FormData): File[] {
  return form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
}

function Field({ label, name, defaultValue, required = false, type = "text", step }: { label: string; name: string; defaultValue?: string | number | null; required?: boolean; type?: "text" | "number" | "date"; step?: string }) {
  return <label className="block text-sm text-ink-soft">{label}<input name={name} type={type} required={required} defaultValue={defaultValue ?? ""} min={type === "number" ? "0" : undefined} step={step ?? (type === "number" ? "1" : undefined)} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /></label>;
}

function TextArea({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  return <label className="block text-sm text-ink-soft">{label}<textarea name={name} defaultValue={defaultValue ?? ""} rows={rows} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /></label>;
}

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-line bg-card p-5 sm:p-6"><h3 className="font-semibold text-ink">{title}</h3>{hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}<div className="mt-4 space-y-4">{children}</div></section>;
}

function ErrorNotice({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-3 py-2 text-sm text-state-error">{message}</p> : null;
}

function IntakeTabs({ active, onChange }: { active: IntakeTab; onChange: (tab: IntakeTab) => void }) {
  return <nav aria-label="Intake-onderdelen" className="rounded-xl border border-line bg-surface p-2"><div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-6">{intakeTabs.map(([key, label, hint]) => <button key={key} type="button" onClick={() => onChange(key)} aria-current={active === key ? "page" : undefined} className={`rounded-lg px-3 py-2 text-left transition-colors ${active === key ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-card"}`}><span className="block text-sm font-semibold">{label}</span><span className={`block text-xs ${active === key ? "text-white/75" : "text-ink-faint"}`}>{hint}</span></button>)}</div></nav>;
}

function IntakeProgress({ bike, intakeReadiness, workshopReadiness, onChange }: { bike: AdminBike; intakeReadiness: { ready: boolean; missing: string[] }; workshopReadiness: { ready: boolean; missing: string[] }; onChange: (tab: IntakeTab) => void }) {
  const items: Array<{ tab: IntakeTab; label: string; detail: string; ready: boolean }> = [
    { tab: "overview", label: "Intake", detail: intakeReadiness.ready ? "Compleet" : `${intakeReadiness.missing.length} openstaand`, ready: intakeReadiness.ready },
    { tab: "specs", label: "Specificaties", detail: bike.brand && bike.model ? "Ingevuld" : "Aanvullen", ready: Boolean(bike.brand && bike.model && bike.bikeType) },
    { tab: "battery", label: "Accu", detail: bike.currentBattery ? `${bike.currentBattery.assetCode} gekoppeld` : bike.batteryWh ? "Legacy gegevens" : "Nog registreren", ready: Boolean(bike.currentBattery || !bike.isElectric) },
    { tab: "condition", label: "Conditie", detail: bike.conditionGrade ? "Ingevuld" : "Aanvullen", ready: Boolean(bike.conditionGrade) },
    { tab: "costs", label: "Kosten", detail: bike.acquisitionCostCents != null ? "Ingevuld" : "Aanvullen", ready: bike.acquisitionCostCents != null },
    { tab: "sale", label: "Verkoop", detail: bike.priceCents > 0 ? "Prijs staat" : "Nog geen prijs", ready: bike.priceCents > 0 },
  ];
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <button key={item.tab} type="button" onClick={() => onChange(item.tab)} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-left hover:border-brand-300"><span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.ready ? "bg-state-success/15 text-state-success" : "bg-state-warning/15 text-state-warning"}`}>{item.ready ? "✓" : "!"}</span><span><span className="block text-xs font-semibold uppercase tracking-wide text-ink-faint">{item.label}</span><span className="block text-sm text-ink-soft">{item.detail}</span></span></button>)}</div>;
}

function FeatureChips({ selected }: { selected: string[] }) {
  const [values, setValues] = useState(selected);
  function toggle(key: string) { setValues((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]); }
  return <div className="mt-2 flex flex-wrap gap-2">{FEATURES.map(([key, label]) => <button key={key} type="button" aria-pressed={values.includes(key)} onClick={() => toggle(key)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${values.includes(key) ? "border-brand-700 bg-brand-50 text-brand-800" : "border-line bg-card text-ink-soft hover:bg-surface"}`}>{values.includes(key) && <span aria-hidden className="mr-1">✓</span>}{label}{values.includes(key) && <input type="hidden" name="features" value={key} />}</button>)}</div>;
}

function BooleanField({ label, name, value, required = false }: { label: string; name: string; value: boolean | null; required?: boolean }) {
  return <label className="block text-sm text-ink-soft">{label}<select name={name} required={required} defaultValue={value == null ? "" : value ? "ja" : "nee"} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"><option value="">Onbekend</option><option value="ja">Ja</option><option value="nee">Nee</option></select></label>;
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
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const modelSuggestions = suggestions.modelsByBrand[brand] ?? [...new Set(Object.values(suggestions.modelsByBrand).flat())].sort((a, b) => a.localeCompare(b, "nl"));
  const inputClass = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";

  function updateTitle(nextBrand: string, nextModel: string) {
    if (!titleEdited) setTitle([nextBrand, nextModel].filter(Boolean).join(" "));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const acquisitionCostCents = euroToCents(form.get("acquisitionPriceEuro"));
    const priceCents = euroToCents(form.get("priceEuro"));
    const files = imageFiles(form);
    if (acquisitionCostCents === null || (String(form.get("priceEuro") ?? "").trim() && priceCents === null)) {
      setError("Controleer de geldbedragen.");
      return;
    }
    if (files.length > 12) { setError("Je kunt maximaal 12 foto’s tegelijk toevoegen."); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/bikes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"), brand: form.get("brand"), model: form.get("model"), variant: form.get("variant"), bikeType: form.get("bikeType"),
          isElectric: form.get("isElectric") === "ja", colour: form.get("colour"), frameSerialRef: form.get("frameSerialRef"),
          acquisitionCostCents, acquisitionDate: form.get("acquisitionDate"), acquisitionSource: form.get("acquisitionSource"), supplierDetails: form.get("supplierDetails"),
          priceCents, conditionGrade: form.get("conditionGrade"), description: form.get("description"),
        }),
      });
      const result = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) { setError(result?.error ?? "De fiets kon niet worden aangemaakt."); return; }
      const upload = await uploadBikeImages(result.id, files);
      if (upload.error) { setError(`Fiets opgeslagen. ${upload.uploaded} van ${files.length} foto’s zijn toegevoegd. ${upload.error}`); return; }
      window.location.assign(`/admin/fietsen/${result.id}`);
    } catch { setError("De verbinding is mislukt. Probeer het opnieuw."); } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="space-y-4"><ErrorNotice message={error} />
    <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">Het inventarisnummer wordt veilig en automatisch toegekend zodra je de intake opslaat. De fiets start altijd in <strong>intake</strong>.</p>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-ink-soft">Merk<input name="brand" list="bike-brands" required value={brand} onChange={(event) => { setBrand(event.target.value); updateTitle(event.target.value, model); }} className={inputClass} /><datalist id="bike-brands">{suggestions.brands.map((value) => <option key={value} value={value} />)}</datalist></label><label className="block text-sm text-ink-soft">Model<input name="model" list="bike-models" required value={model} onChange={(event) => { setModel(event.target.value); updateTitle(brand, event.target.value); }} className={inputClass} /><datalist id="bike-models">{modelSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label></div>
    <label className="block text-sm text-ink-soft">Titel<input name="title" required value={title} onChange={(event) => { setTitleEdited(true); setTitle(event.target.value); }} className={inputClass} /><span className="mt-1 block text-xs text-ink-faint">Wordt uit merk en model opgebouwd, maar blijft bewerkbaar.</span></label>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Uitvoering (optioneel)" name="variant" /><label className="block text-sm text-ink-soft">Fietstype<input name="bikeType" list="bike-types" required className={inputClass} /><datalist id="bike-types">{suggestions.bikeTypes.map((value) => <option key={value} value={value} />)}</datalist></label><BooleanField label="Elektrisch" name="isElectric" value={null} required /><label className="block text-sm text-ink-soft">Kleur<input name="colour" list="bike-colours" required className={inputClass} /><datalist id="bike-colours">{suggestions.colours.map((value) => <option key={value} value={value} />)}</datalist></label><Field label="Framenummer" name="frameSerialRef" required /><Field label="Inkoopdatum" name="acquisitionDate" type="date" required /><Field label="Inkoopprijs (€)" name="acquisitionPriceEuro" type="number" step="0.01" required /><Field label="Vraagprijs (€; later mogelijk)" name="priceEuro" type="number" step="0.01" /><label className="block text-sm text-ink-soft">Conditie<input name="conditionGrade" list="bike-conditions" className={inputClass} /><datalist id="bike-conditions">{suggestions.conditions.map((value) => <option key={value} value={value} />)}</datalist></label><Field label="Inkoopbron / leverancier" name="acquisitionSource" /><Field label="Bronnotitie" name="supplierDetails" /></div>
    <TextArea label="Eerste winkelbeschrijving (optioneel)" name="description" rows={5} />
    <fieldset className="rounded-xl border border-line bg-surface p-4"><legend className="px-1 text-sm font-semibold text-ink">Foto’s</legend><p className="mb-3 text-xs text-ink-faint">Selecteer maximaal 12 foto’s. De eerste foto is publiek en wordt de omslagfoto.</p><input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="block w-full text-sm text-ink-soft" /></fieldset>
    <button type="submit" disabled={busy} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70">{busy ? "Intake opslaan…" : "Fiets als intake opslaan"}</button>
  </form>;
}

function collectDossier(form: FormData): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  const textFields = ["title", "inventoryCode", "slug", "brand", "model", "variant", "bikeType", "frameStyle", "genderStyle", "colour", "brakeInfo", "drivetrainInfo", "motorManufacturer", "motorModel", "motorPosition", "motorDescription", "electricalNotes", "batteryType", "batteryManufacturer", "batteryModel", "batteryTestMethod", "batteryCondition", "batterySerialRef", "batteryNotes", "conditionGrade", "conditionDescription", "cosmeticDefects", "technicalDefects", "repairSummary", "description", "acquisitionSource", "supplierDetails", "labourNotes", "frameSerialRef", "storageLocation", "workshopNotes", "internalNotes", "saleLabel"];
  for (const name of textFields) data[name] = form.get(name);
  const integerFields = ["modelYear", "frameSizeCm", "gears", "assistanceLevels", "nominalVoltage", "batteryVoltage", "batteryWh", "batteryMeasuredWh", "batteryCycleCount", "rangeMinKm", "rangeMaxKm", "batteryWarrantyMonths", "labourMinutes"];
  for (const name of integerFields) { const value = optionalInteger(form, name); if (value === "invalid") return { error: "Controleer de hele getallen in het dossier." }; data[name] = value; }
  for (const name of ["wheelSizeInches", "batteryAh", "batteryMeasuredAh", "batterySohPercent"]) { const value = optionalDecimal(form, name); if (value === "invalid") return { error: "Controleer wielmaat en accucapaciteit." }; data[name] = value; }
  const priceCents = euroToCents(form.get("priceEuro"));
  if (priceCents === null) return { error: "Vul een geldige vraagprijs in." };
  data.priceCents = priceCents;
  for (const [formName, field] of [["acquisitionPriceEuro", "acquisitionCostCents"], ["partsCostEuro", "partsCostCents"], ["repairCostEuro", "repairCostCents"], ["otherCostEuro", "otherCostCents"]] as const) {
    const value = euroToCents(form.get(formName));
    if (String(form.get(formName) ?? "").trim() && value === null) return { error: "Controleer de kostenbedragen." };
    data[field] = value;
  }
  data.isElectric = optionalBoolean(form, "isElectric");
  data.walkAssist = optionalBoolean(form, "walkAssist");
  data.batteryReconditioned = optionalBoolean(form, "batteryReconditioned");
  data.acquisitionDate = form.get("acquisitionDate") || null;
  data.batteryRevisionDate = form.get("batteryRevisionDate") || null;
  data.batteryTestDate = form.get("batteryTestDate") || null;
  data.features = form.getAll("features");
  return { data };
}

export function AdminBikeEditor({ bike, margin, auditEvents, intakeReadiness, workshopReadiness }: { bike: AdminBike; margin: Margin; auditEvents: AuditEvent[]; intakeReadiness: { ready: boolean; missing: string[] }; workshopReadiness: { ready: boolean; missing: string[] } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"save" | "status" | "image" | "task" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderedImages, setOrderedImages] = useState(bike.images);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const parsed = collectDossier(new FormData(event.currentTarget));
    if (!parsed.data) { setError(parsed.error ?? "Controleer het formulier."); return; }
    setBusy("save"); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update", ...parsed.data }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) { setError(result?.error ?? "Opslaan is niet gelukt."); return; }
      router.refresh(); setNotice("Het fietsdossier is opgeslagen.");
    } catch { setError("De verbinding is mislukt. Probeer het opnieuw."); } finally { setBusy(null); }
  }

  async function changeStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const status = new FormData(event.currentTarget).get("status");
    setBusy("status"); setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status", status }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) { setError(result?.error ?? "De status kon niet worden gewijzigd."); return; }
      router.refresh();
    } catch { setError("De verbinding is mislukt."); } finally { setBusy(null); }
  }

  async function uploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const files = imageFiles(new FormData(event.currentTarget));
    if (!files.length || files.length > 12) { setError(!files.length ? "Kies eerst foto’s." : "Je kunt maximaal 12 foto’s tegelijk toevoegen."); return; }
    setBusy("image"); setError(null);
    try { const upload = await uploadBikeImages(bike.id, files); if (upload.error) { setError(upload.error); return; } router.refresh(); } catch { setError("De verbinding is mislukt."); } finally { setBusy(null); }
  }

  async function imageAction(action: "cover" | "visibility" | "delete" | "reorder", imageId?: string, extras?: Record<string, unknown>) {
    setBusy("image"); setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}/images`, { method: action === "delete" ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "reorder" ? { action, ids: orderedImages.map((image) => image.id) } : { action, imageId, ...extras }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) { setError(result?.error ?? "De foto kon niet worden bijgewerkt."); return; }
      router.refresh();
    } catch { setError("De verbinding is mislukt."); } finally { setBusy(null); }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const next = [...orderedImages]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!]; setOrderedImages(next);
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); const partCostCents = euroToCents(form.get("partCostEuro")); const quantity = optionalInteger(form, "quantity");
    if (partCostCents === null || quantity === "invalid" || quantity === null || quantity < 1) { setError("Controleer de werkplaatsregel."); return; }
    setBusy("task"); setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bike.id}/service-tasks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: form.get("taskDescription"), partCostCents, quantity, internalNotes: form.get("taskNotes"), completed: form.get("completed") === "yes" }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) { setError(result?.error ?? "De werkplaatsregel kon niet worden opgeslagen."); return; }
      router.refresh();
    } catch { setError("De verbinding is mislukt."); } finally { setBusy(null); }
  }

  async function completeTask(taskId: string, completed: boolean) {
    setBusy("task"); setError(null);
    try { const response = await fetch(`/api/admin/bikes/${bike.id}/service-tasks`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, completed }) }); const result = (await response.json().catch(() => null)) as { error?: string } | null; if (!response.ok) { setError(result?.error ?? "De werkplaatsregel kon niet worden bijgewerkt."); return; } router.refresh(); } catch { setError("De verbinding is mislukt."); } finally { setBusy(null); }
  }

  const lifecycleManaged = ["RESERVED", "SALE_PENDING"].includes(bike.status);
  const statusChoices = bike.status === "SOLD" ? [["ARCHIVED", "Archiveren"]] as Array<[BikeStatus, string]> : editableStatuses;
  return <div className="max-w-6xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{bike.inventoryCode} · intake {formatDate(bike.acquisitionDate ?? bike.createdAt)}</p><h2 className="text-2xl font-bold tracking-tight text-ink">{bike.title}</h2></div>{lifecycleManaged ? <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">Status: <strong>{bike.status === "RESERVED" ? "Gereserveerd" : "Verkoop wordt afgerond"}</strong><br /><span className="text-xs">Deze status wordt door de reserverings- en verkooplifecycle beheerd.</span></p> : <form onSubmit={changeStatus} className="flex items-end gap-2"><label className="text-sm text-ink-soft">Status<select name="status" defaultValue={bike.status === "SOLD" ? "ARCHIVED" : bike.status} className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink">{statusChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="submit" disabled={busy !== null} className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-70">{busy === "status" ? "Wijzigen…" : bike.status === "SOLD" ? "Archiveren" : "Status wijzigen"}</button></form>}</div>
    <div className="mt-5 space-y-3"><ErrorNotice message={error} />{notice && <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">{notice}</p>}</div>
    <form onSubmit={save} className="mt-6 space-y-6"><Section title="Overzicht" hint="Identiteit en plaats in de voorraad."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Inventarisnummer" name="inventoryCode" defaultValue={bike.inventoryCode} required /><Field label="Titel" name="title" defaultValue={bike.title} required /><Field label="Slug" name="slug" defaultValue={bike.slug} required /><Field label="Merk" name="brand" defaultValue={bike.brand} required /><Field label="Model" name="model" defaultValue={bike.model} required /><Field label="Uitvoering" name="variant" defaultValue={bike.variant} /><Field label="Bouwjaar" name="modelYear" type="number" defaultValue={bike.modelYear} /><Field label="Fietstype" name="bikeType" defaultValue={bike.bikeType} /><BooleanField label="Elektrisch" name="isElectric" value={bike.isElectric} required /><Field label="Kleur" name="colour" defaultValue={bike.colour} /><Field label="Framenummer (intern)" name="frameSerialRef" defaultValue={bike.frameSerialRef} /><Field label="Opslaglocatie (intern)" name="storageLocation" defaultValue={bike.storageLocation} /></div></Section>
      <Section title="Specificaties"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Framemaat (cm)" name="frameSizeCm" type="number" defaultValue={bike.frameSizeCm} /><Field label="Wielmaat (inch)" name="wheelSizeInches" type="number" step="0.1" defaultValue={bike.wheelSizeInches} /><Field label="Versnellingen" name="gears" type="number" defaultValue={bike.gears} /><Field label="Ondersteuningsniveaus" name="assistanceLevels" type="number" defaultValue={bike.assistanceLevels} /><Field label="Frametype" name="frameStyle" defaultValue={bike.frameStyle} /><Field label="Doelgroep" name="genderStyle" defaultValue={bike.genderStyle} /></div><div className="grid gap-4 sm:grid-cols-2"><TextArea label="Aandrijving / transmissie" name="drivetrainInfo" defaultValue={bike.drivetrainInfo} /><TextArea label="Remmen" name="brakeInfo" defaultValue={bike.brakeInfo} /></div><fieldset><legend className="text-sm font-medium text-ink-soft">Features & accessoires</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-ink-soft"><input name="features" value={key} type="checkbox" defaultChecked={bike.features.includes(key)} /> {label}</label>)}</div></fieldset></Section>
      <Section title="Accu & elektrisch" hint="Serienummer en interne accunotities komen nooit op de publieke fietsdetailpagina."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Motorfabrikant" name="motorManufacturer" defaultValue={bike.motorManufacturer} /><Field label="Motormodel" name="motorModel" defaultValue={bike.motorModel} /><Field label="Motorpositie" name="motorPosition" defaultValue={bike.motorPosition} /><Field label="Motorvoltage (V)" name="nominalVoltage" type="number" defaultValue={bike.nominalVoltage} /><BooleanField label="Loopondersteuning" name="walkAssist" value={bike.walkAssist} /><Field label="Accumerk / -model" name="batteryType" defaultValue={bike.batteryType} /><Field label="Accuvoltage (V)" name="batteryVoltage" type="number" defaultValue={bike.batteryVoltage} /><Field label="Accucapaciteit (Ah)" name="batteryAh" type="number" step="0.01" defaultValue={bike.batteryAh} /><Field label="Accucapaciteit (Wh)" name="batteryWh" type="number" defaultValue={bike.batteryWh} /><Field label="Accustaat / SOH" name="batteryCondition" defaultValue={bike.batteryCondition} /><Field label="Gemeten actieradius min. (km)" name="rangeMinKm" type="number" defaultValue={bike.rangeMinKm} /><Field label="Geschatte actieradius max. (km)" name="rangeMaxKm" type="number" defaultValue={bike.rangeMaxKm} /><BooleanField label="Accu gereviseerd" name="batteryReconditioned" value={bike.batteryReconditioned} /><Field label="Accurevisiedatum" name="batteryRevisionDate" type="date" defaultValue={bike.batteryRevisionDate ? new Date(bike.batteryRevisionDate).toISOString().slice(0, 10) : ""} /><Field label="Accugarantie (maanden)" name="batteryWarrantyMonths" type="number" defaultValue={bike.batteryWarrantyMonths} /><Field label="Accuserienummer (intern)" name="batterySerialRef" defaultValue={bike.batterySerialRef} /></div><div className="grid gap-4 sm:grid-cols-2"><TextArea label="Motorinformatie" name="motorDescription" defaultValue={bike.motorDescription} /><TextArea label="Overige elektrische informatie" name="electricalNotes" defaultValue={bike.electricalNotes} /><TextArea label="Interne accunotities" name="batteryNotes" defaultValue={bike.batteryNotes} /></div></Section>
      <Section title="Conditie"><div className="grid gap-4 sm:grid-cols-2"><Field label="Algemene conditie" name="conditionGrade" defaultValue={bike.conditionGrade} /><TextArea label="Conditiebeschrijving" name="conditionDescription" defaultValue={bike.conditionDescription} /><TextArea label="Cosmetische gebreken" name="cosmeticDefects" defaultValue={bike.cosmeticDefects} /><TextArea label="Technische gebreken" name="technicalDefects" defaultValue={bike.technicalDefects} /><TextArea label="Uitgevoerd onderhoud / reparaties" name="repairSummary" defaultValue={bike.repairSummary} /><TextArea label="Interne werkplaatsnotities" name="workshopNotes" defaultValue={bike.workshopNotes} /></div></Section>
      <Section title="Inkoop & kosten" hint="Alle bedragen worden server-side als hele centen opgeslagen; marge wordt alleen op de server berekend."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Inkoopdatum" name="acquisitionDate" type="date" defaultValue={bike.acquisitionDate ? new Date(bike.acquisitionDate).toISOString().slice(0, 10) : ""} /><Field label="Inkoopprijs (€)" name="acquisitionPriceEuro" type="number" step="0.01" defaultValue={bike.acquisitionCostCents != null ? (bike.acquisitionCostCents / 100).toFixed(2) : ""} /><Field label="Inkoopbron / leverancier" name="acquisitionSource" defaultValue={bike.acquisitionSource} /><Field label="Onderdelenkosten (€)" name="partsCostEuro" type="number" step="0.01" defaultValue={(bike.partsCostCents / 100).toFixed(2)} /><Field label="Reparatiekosten (€)" name="repairCostEuro" type="number" step="0.01" defaultValue={(bike.repairCostCents / 100).toFixed(2)} /><Field label="Overige kosten (€)" name="otherCostEuro" type="number" step="0.01" defaultValue={(bike.otherCostCents / 100).toFixed(2)} /><Field label="Arbeidstijd (minuten)" name="labourMinutes" type="number" defaultValue={bike.labourMinutes} /></div><div className="grid gap-4 sm:grid-cols-2"><TextArea label="Bronnotitie / leverancierdetails" name="supplierDetails" defaultValue={bike.supplierDetails} /><TextArea label="Arbeidsnotities" name="labourNotes" defaultValue={bike.labourNotes} /><TextArea label="Interne notities" name="internalNotes" defaultValue={bike.internalNotes} /></div><div className="grid gap-3 rounded-lg bg-surface p-4 text-sm sm:grid-cols-3"><p><span className="block text-xs text-ink-faint">Totale kostprijs</span><strong>{formatPrice(margin.totalCostCents)}</strong></p><p><span className="block text-xs text-ink-faint">Verwachte brutomarge</span><strong>{margin.expectedGrossMarginCents == null ? "—" : `${formatPrice(margin.expectedGrossMarginCents)}${margin.expectedMarginPercent != null ? ` (${margin.expectedMarginPercent}%)` : ""}`}</strong></p><p><span className="block text-xs text-ink-faint">Gerealiseerde brutomarge</span><strong>{margin.grossMarginCents == null ? "Nog niet verkocht" : `${formatPrice(margin.grossMarginCents)}${margin.marginPercent != null ? ` (${margin.marginPercent}%)` : ""}`}</strong></p></div></Section>
      <Section title="Verkoop" hint="‘Verkocht’ wordt uitsluitend door de centrale verkoopafronding gezet."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Vraagprijs (€)" name="priceEuro" type="number" step="0.01" defaultValue={(bike.priceCents / 100).toFixed(2)} required /><Field label="Verkooplabel" name="saleLabel" defaultValue={bike.saleLabel} /><div className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft"><span className="block text-xs text-ink-faint">Realisatie</span>{bike.realisedSalePriceCents == null ? "Nog niet verkocht" : `${formatPrice(bike.realisedSalePriceCents)} · ${bike.soldOrderNumber ?? "zonder ordernummer"}`}</div></div><TextArea label="Winkelbeschrijving" name="description" defaultValue={bike.description} rows={8} /></Section>
      <button type="submit" disabled={busy !== null} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70">{busy === "save" ? "Opslaan…" : "Alle dossierwijzigingen opslaan"}</button>
    </form>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><BikeIntakePanel bikeId={bike.id} intake={bike.intakeRecord} readiness={intakeReadiness} /><BikeWorkshopPanel bikeId={bike.id} tasks={bike.serviceTasks} readiness={workshopReadiness} /><BatteryDossierPanel bikeId={bike.id} battery={{ manufacturer: bike.batteryManufacturer, model: bike.batteryModel, voltage: bike.batteryVoltage, nominalAh: bike.batteryAh, nominalWh: bike.batteryWh, measuredAh: bike.batteryMeasuredAh, measuredWh: bike.batteryMeasuredWh, sohPercent: bike.batterySohPercent, testDate: bike.batteryTestDate, testMethod: bike.batteryTestMethod, cycles: bike.batteryCycleCount, serial: bike.batterySerialRef, reconditioned: bike.batteryReconditioned, warrantyMonths: bike.batteryWarrantyMonths }} /><BatteryLabelPanel bikeId={bike.id} photoKey={bike.batteryLabelPhotoKey} /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Section title="Foto’s" hint="Interne foto’s zijn alleen zichtbaar in dit dossier en tellen niet voor publicatie."><form onSubmit={uploadImage} className="flex flex-wrap items-end gap-3"><input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="block text-sm text-ink-soft" /><button type="submit" disabled={busy !== null} className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">{busy === "image" ? "Uploaden…" : "Foto’s uploaden"}</button></form>{orderedImages.length > 0 ? <><ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{orderedImages.map((image, index) => <li key={image.id} className="overflow-hidden rounded-lg border border-line bg-surface"><Image src={mediaWidthUrl(image.storageKey, 256)} alt={`Fietsafbeelding ${index + 1}`} width={Math.max(1, image.width)} height={Math.max(1, image.height)} unoptimized className="aspect-square w-full object-cover" /><div className="space-y-1 px-2 py-2 text-xs"><p>{image.isInternal ? "Intern" : image.isCover ? "Omslagfoto" : "Publiek"}</p><div className="flex flex-wrap gap-x-2 gap-y-1"><button type="button" disabled={busy !== null || image.isInternal} onClick={() => imageAction("cover", image.id)} className="text-brand-800 underline disabled:opacity-40">Omslag</button><button type="button" disabled={busy !== null} onClick={() => imageAction("visibility", image.id, { isInternal: !image.isInternal })} className="text-brand-800 underline">{image.isInternal ? "Publiek" : "Intern"}</button><button type="button" disabled={busy !== null || index === 0} onClick={() => moveImage(index, -1)} className="text-brand-800 underline disabled:opacity-40">↑</button><button type="button" disabled={busy !== null || index === orderedImages.length - 1} onClick={() => moveImage(index, 1)} className="text-brand-800 underline disabled:opacity-40">↓</button><button type="button" disabled={busy !== null} onClick={() => { if (window.confirm("Deze foto permanent verwijderen?")) imageAction("delete", image.id); }} className="text-state-error underline">Verwijder</button></div></div></li>)}</ul><button type="button" disabled={busy !== null} onClick={() => imageAction("reorder")} className="mt-3 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surface">Volgorde opslaan</button></> : <p className="mt-4 text-sm text-ink-soft">Nog geen foto’s.</p>}</Section></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><Section title="Prijshistorie">{bike.priceHistory.length ? <ul className="space-y-2 text-sm">{bike.priceHistory.map((entry) => <li key={entry.id} className="rounded-lg bg-surface p-3"><strong>{formatPrice(entry.oldPriceCents)} → {formatPrice(entry.newPriceCents)}</strong><p className="text-xs text-ink-faint">{formatDateTime(entry.createdAt)} · {entry.changedBy ?? "Onbekend"}</p></li>)}</ul> : <p className="text-sm text-ink-soft">Nog geen prijswijzigingen.</p>}</Section><Section title="Historie"><ul className="space-y-2 text-sm">{auditEvents.map((event) => <li key={event.id} className="rounded-lg bg-surface p-3"><strong>{event.action}</strong><p className="text-xs text-ink-faint">{formatDateTime(event.createdAt)} · {event.actor}</p>{event.meta && <p className="mt-1 break-words text-xs text-ink-soft">{event.meta}</p>}</li>)}{auditEvents.length === 0 && <li className="text-sm text-ink-soft">Nog geen gelogde wijzigingen.</li>}</ul></Section></div>
  </div>;
}

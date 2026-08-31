"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mediaWidthUrl } from "@/lib/media";
import { formatDate, formatPrice } from "@/lib/utils";

type Readiness = { ready: boolean; missing: string[] };
type Intake = {
  frameSerialPresent: boolean;
  keysPresent: boolean;
  chargerPresent: boolean;
  batteryPresent: boolean;
  defectsAssessed: boolean;
  knownDefects: string | null;
  theftCheckCompleted: boolean;
  theftCheckDate: string | Date | null;
  theftCheckResult: string | null;
} | null;
type IntakeCheckKey = "frameSerialPresent" | "keysPresent" | "chargerPresent" | "batteryPresent" | "defectsAssessed" | "theftCheckCompleted";
const intakeChecks: Array<[IntakeCheckKey, string]> = [
  ["frameSerialPresent", "Framenummer aanwezig en gecontroleerd"],
  ["keysPresent", "Sleutels aanwezig"],
  ["chargerPresent", "Lader aanwezig"],
  ["batteryPresent", "Accu aanwezig"],
  ["defectsAssessed", "Bekende gebreken beoordeeld"],
  ["theftCheckCompleted", "Diefstalcontrole uitgevoerd"],
];
type Task = {
  id: string;
  description: string;
  checklistKey: string | null;
  inspectionResult: "PASS" | "ATTENTION" | "FAIL" | "NOT_APPLICABLE" | null;
  partName: string | null;
  partCostCents: number | null;
  quantity: number;
  labourMinutes: number | null;
  labourCostCents: number | null;
  internalNotes: string | null;
  photoKeys: string[];
  doneDate: string | Date | null;
  completed: boolean;
  completedBy: { name: string | null; email: string } | null;
};

function Notice({ readiness, label }: { readiness: Readiness; label: string }) {
  if (readiness.ready)
    return (
      <p className="rounded-lg bg-state-success/10 px-3 py-2 text-sm text-state-success">
        {label} is compleet.
      </p>
    );
  return (
    <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 px-3 py-2 text-sm text-ink-soft">
      <strong>{label} nog niet compleet:</strong>
      <ul className="mt-1 list-disc pl-5">
        {readiness.missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

async function responseError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return result?.error ?? fallback;
}

export function BikeIntakePanel({
  bikeId,
  intake,
  batteryLinked = false,
  readiness,
}: {
  bikeId: string;
  intake: Intake;
  batteryLinked?: boolean;
  readiness: Readiness;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}/intake`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frameSerialPresent: form.get("frameSerialPresent") === "yes",
          keysPresent: form.get("keysPresent") === "yes",
          chargerPresent: form.get("chargerPresent") === "yes",
          batteryPresent: form.get("batteryPresent") === "yes",
          defectsAssessed: form.get("defectsAssessed") === "yes",
          knownDefects: form.get("knownDefects"),
          theftCheckCompleted: form.get("theftCheckCompleted") === "yes",
          theftCheckDate: form.get("theftCheckDate"),
          theftCheckResult: form.get("theftCheckResult"),
        }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "De intake kon niet worden opgeslagen.",
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  const [checks, setChecks] = useState<Record<IntakeCheckKey, boolean>>(() => ({
    frameSerialPresent: Boolean(intake?.frameSerialPresent),
    keysPresent: Boolean(intake?.keysPresent),
    chargerPresent: Boolean(intake?.chargerPresent),
    batteryPresent: Boolean(intake?.batteryPresent || batteryLinked),
    defectsAssessed: Boolean(intake?.defectsAssessed),
    theftCheckCompleted: Boolean(intake?.theftCheckCompleted),
  }));
  const date = intake?.theftCheckDate
    ? new Date(intake.theftCheckDate).toISOString().slice(0, 10)
    : "";
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-ink">Intakecontrole</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Eén korte controlelijst. Inkoopbron, -datum en -prijs staan bij Kosten.
      </p>
      <div className="mt-3">
        <Notice readiness={readiness} label="Intake" />
      </div>
      {error && <p className="mt-3 text-sm text-state-error">{error}</p>}
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-line bg-surface p-3"><legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Controlepunten</legend><p className="mt-1 text-xs text-ink-faint">Klik een regel aan zodra die is gecontroleerd.</p><div className="mt-1 divide-y divide-line">
          {intakeChecks.map(([key, label]) => {
            const active = checks[key];
            return <div key={key} className="flex items-center gap-2 py-1"><button type="button" aria-pressed={active} onClick={() => setChecks((current) => ({ ...current, [key]: !current[key] }))} className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm text-ink-soft hover:bg-card"><span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${active ? "border-state-success bg-state-success/10 text-state-success" : "border-line text-ink-faint"}`}>{active ? "✓" : ""}</span><span>{label}</span></button>{active && <input type="hidden" name={key} value="yes" />}</div>;
          })}
        </div></fieldset>
        <div className="grid gap-3">
          <label className="text-sm text-ink-soft">
            Datum diefstalcontrole
            <input
              name="theftCheckDate"
              type="date"
              defaultValue={date}
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
            />
          </label>
          <label className="text-sm text-ink-soft">
            Resultaat diefstalcontrole
            <input
              name="theftCheckResult"
              defaultValue={intake?.theftCheckResult ?? ""}
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
            />
          </label>
        </div>
        <label className="sm:col-span-2 text-sm text-ink-soft">
          Bekende gebreken / intake-opmerkingen
          <textarea
            name="knownDefects"
            defaultValue={intake?.knownDefects ?? ""}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <button
          className="w-fit rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Opslaan…" : "Intake opslaan"}
        </button>
      </form>
    </section>
  );
}

export function BatteryLabelPanel({
  bikeId,
  batteryId,
  photoKey,
}: {
  bikeId: string;
  batteryId?: string;
  photoKey: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("label");
    if (!(file instanceof File) || file.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(batteryId ? `/api/admin/batteries/${batteryId}/label` : `/api/admin/bikes/${bikeId}/battery-label`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setError(
          await responseError(response, "Acculabel kon niet worden geüpload."),
        );
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
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-ink">Acculabel</h3>
      <p className="mt-1 text-sm text-ink-soft">Alleen intern zichtbaar.</p>
      {photoKey && (
        <Image
          src={mediaWidthUrl(photoKey, 512)}
          alt="Acculabel"
          width={512}
          height={512}
          unoptimized
          className="mt-3 max-h-52 w-auto rounded-lg object-contain"
        />
      )}
      <form onSubmit={upload} className="mt-3 flex flex-wrap items-end gap-3">
        <input
          name="label"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="text-sm"
        />
        <button
          disabled={busy}
          className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-60"
        >
          {busy ? "Uploaden…" : "Label uploaden"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-state-error">{error}</p>}
    </section>
  );
}

export function BatteryDossierPanel({
  bikeId,
  currentBattery,
  battery,
}: {
  bikeId: string;
  currentBattery?: { id: string; assetCode: string; status: string; manufacturer: string | null; model: string | null; serialNumber: string | null; nominalWh: number | null } | null;
  battery: {
    manufacturer: string | null;
    model: string | null;
    voltage: number | null;
    nominalAh: number | null;
    nominalWh: number | null;
    measuredAh: number | null;
    measuredWh: number | null;
    sohPercent: number | null;
    testDate: string | Date | null;
    testMethod: string | null;
    cycles: number | null;
    serial: string | null;
    reconditioned: boolean | null;
    warrantyMonths: number | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function detach() {
    if (!currentBattery || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/batteries/${currentBattery.id}/assign`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: "Losgekoppeld vanuit fietsintake." }) });
      if (!response.ok) { setError(await responseError(response, "De accu kon niet worden losgekoppeld.")); return; }
      router.refresh();
    } catch { setError("De verbinding is mislukt."); } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const integers = [
      "batteryVoltage",
      "batteryWh",
      "batteryMeasuredWh",
      "batteryCycleCount",
      "batteryWarrantyMonths",
    ];
    const decimals = ["batteryAh", "batteryMeasuredAh", "batterySohPercent"];
    const data: Record<string, unknown> = {};
    for (const key of integers) {
      const raw = String(form.get(key) ?? "").trim();
      data[key] = raw ? Number(raw) : null;
      if (raw && !Number.isSafeInteger(data[key])) {
        setError("Controleer de hele getallen in het accudossier.");
        return;
      }
    }
    for (const key of decimals) {
      const raw = String(form.get(key) ?? "")
        .trim()
        .replace(",", ".");
      data[key] = raw ? Number(raw) : null;
      if (raw && !Number.isFinite(data[key])) {
        setError("Controleer de gemeten en nominale capaciteiten.");
        return;
      }
    }
    for (const key of [
      "batteryManufacturer",
      "batteryModel",
      "batteryTestMethod",
      "batterySerialRef",
    ])
      data[key] = form.get(key);
    data.batteryTestDate = form.get("batteryTestDate") || null;
    data.batteryReconditioned =
      form.get("batteryReconditioned") === "yes"
        ? true
        : form.get("batteryReconditioned") === "no"
          ? false
          : null;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", ...data }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "Accudossier kon niet worden opgeslagen.",
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  const date = battery.testDate
    ? new Date(battery.testDate).toISOString().slice(0, 10)
    : "";
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold text-ink">Accu</h3><p className="mt-1 text-sm text-ink-soft">De accu is een zelfstandig dossier en kan later aan een andere fiets worden gekoppeld.</p></div>{currentBattery ? <div className="flex flex-wrap items-center gap-2 text-sm"><Link href={`/admin/accu/${currentBattery.id}`} className="rounded-lg border border-brand-700 px-3 py-2 font-semibold text-brand-800">{currentBattery.assetCode} openen</Link><button type="button" onClick={detach} disabled={busy} className="rounded-lg border border-state-error/40 px-3 py-2 font-semibold text-state-error disabled:opacity-60">Loskoppelen</button></div> : <Link href="/admin/accu" className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800">Accu registreren / koppelen</Link>}</div>
      {currentBattery && <p className="mt-2 rounded-lg bg-state-success/10 px-3 py-2 text-sm text-state-success">Nu gekoppeld: <strong>{[currentBattery.manufacturer, currentBattery.model].filter(Boolean).join(" ") || currentBattery.assetCode}</strong>{currentBattery.nominalWh ? ` · ${currentBattery.nominalWh} Wh` : ""}</p>}
       {!currentBattery && <p className="mt-1 text-sm text-ink-soft">Legacy-fietsvelden hieronder blijven beschikbaar voor bestaande verkoop- en publicatiesnapshots. Registreer daarna een zelfstandige accu via Accu’s.</p>}
       {currentBattery && <p className="mt-2 text-xs text-ink-faint">Nieuwe metingen en reparaties beheer je in het zelfstandige accudossier hierboven. De oude velden zijn bewust verborgen om dubbele invoer te voorkomen.</p>}
      {error && <p className="mt-3 text-sm text-state-error">{error}</p>}
       {!currentBattery && <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">
          Fabrikant
          <input
            name="batteryManufacturer"
            defaultValue={battery.manufacturer ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Model
          <input
            name="batteryModel"
            defaultValue={battery.model ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Serienummer (intern)
          <input
            name="batterySerialRef"
            defaultValue={battery.serial ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Nominaal voltage (V)
          <input
            name="batteryVoltage"
            type="number"
            min="0"
            defaultValue={battery.voltage ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Nominale Ah
          <input
            name="batteryAh"
            type="number"
            min="0"
            step="0.01"
            defaultValue={battery.nominalAh ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Nominale Wh
          <input
            name="batteryWh"
            type="number"
            min="0"
            defaultValue={battery.nominalWh ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Gemeten Ah
          <input
            name="batteryMeasuredAh"
            type="number"
            min="0"
            step="0.01"
            defaultValue={battery.measuredAh ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Gemeten Wh
          <input
            name="batteryMeasuredWh"
            type="number"
            min="0"
            defaultValue={battery.measuredWh ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Gemeten SOH (%)
          <input
            name="batterySohPercent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={battery.sohPercent ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Testdatum
          <input
            name="batteryTestDate"
            type="date"
            defaultValue={date}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Testmethode
          <input
            name="batteryTestMethod"
            defaultValue={battery.testMethod ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Cycli (indien bekend)
          <input
            name="batteryCycleCount"
            type="number"
            min="0"
            defaultValue={battery.cycles ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Revisie
          <select
            name="batteryReconditioned"
            defaultValue={
              battery.reconditioned == null
                ? ""
                : battery.reconditioned
                  ? "yes"
                  : "no"
            }
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          >
            <option value="">Onbekend</option>
            <option value="yes">Gereviseerd</option>
            <option value="no">Niet gereviseerd</option>
          </select>
        </label>
        <label className="text-sm text-ink-soft">
          Garantie (maanden)
          <input
            name="batteryWarrantyMonths"
            type="number"
            min="0"
            defaultValue={battery.warrantyMonths ?? ""}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <button
          disabled={busy}
          className="w-fit rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-60"
        >
          {busy ? "Opslaan…" : "Accudossier opslaan"}
        </button>
       </form>}
    </section>
  );
}

export function BikeWorkshopPanel({
  bikeId,
  tasks,
  readiness,
}: {
  bikeId: string;
  tasks: Task[];
  readiness: Readiness;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const checklist = tasks.filter((task) => task.checklistKey);
  const extraTasks = tasks.filter((task) => !task.checklistKey);
  async function update(
    taskId: string,
    completed: boolean,
    inspectionResult?: Task["inspectionResult"],
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}/service-tasks`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, completed, inspectionResult }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "Werkplaatsregel kon niet worden bijgewerkt.",
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Math.round(Number(form.get("partCostEuro") || 0) * 100);
    const labour = Math.round(Number(form.get("labourCostEuro") || 0) * 100);
    const quantity = Number(form.get("quantity") || 1);
    const labourMinutes = Number(form.get("labourMinutes") || 0);
    if (
      !String(form.get("description") ?? "").trim() ||
      !Number.isInteger(amount) ||
      !Number.isInteger(labour) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isInteger(labourMinutes) ||
      labourMinutes < 0
    ) {
      setError("Controleer omschrijving, aantallen en bedragen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}/service-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: form.get("description"),
          partName: form.get("partName"),
          partCostCents: amount,
          quantity,
          labourMinutes,
          labourCostCents: labour,
          internalNotes: form.get("internalNotes"),
          doneDate: form.get("doneDate"),
          completed: form.get("completed") === "yes",
        }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "Werkplaatsregel kon niet worden opgeslagen.",
          ),
        );
        return;
      }
      router.refresh();
      event.currentTarget.reset();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  async function photos(
    taskId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const files = Array.from(
      new FormData(event.currentTarget).getAll("photos"),
    ).filter((file): file is File => file instanceof File && file.size > 0);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch(
          `/api/admin/bikes/${bikeId}/service-tasks/${taskId}/images`,
          { method: "POST", body },
        );
        if (!response.ok)
          throw new Error(
            await responseError(response, "Foto kon niet worden geüpload."),
          );
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "De verbinding is mislukt.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeTask(taskId: string) {
    if (
      !window.confirm(
        "Deze werkplaatsregel verwijderen? Eventuele geboekte kosten worden veilig teruggedraaid.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}/service-tasks`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "Werkplaatsregel kon niet worden verwijderd.",
          ),
        );
        return;
      }
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  async function edit(taskId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const partCostCents = Math.round(
      Number(form.get("partCostEuro") || 0) * 100,
    );
    const labourCostCents = Math.round(
      Number(form.get("labourCostEuro") || 0) * 100,
    );
    const quantity = Number(form.get("quantity") || 1);
    const labourMinutes = Number(form.get("labourMinutes") || 0);
    if (
      !String(form.get("description") ?? "").trim() ||
      !Number.isInteger(partCostCents) ||
      !Number.isInteger(labourCostCents) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isInteger(labourMinutes) ||
      labourMinutes < 0
    ) {
      setError("Controleer omschrijving, aantallen en bedragen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bikes/${bikeId}/service-tasks`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          taskId,
          description: form.get("description"),
          partName: form.get("partName"),
          partCostCents,
          quantity,
          labourMinutes,
          labourCostCents,
          internalNotes: form.get("internalNotes"),
          doneDate: form.get("doneDate"),
          completed: form.get("completed") === "yes",
        }),
      });
      if (!response.ok) {
        setError(
          await responseError(
            response,
            "Werkplaatsregel kon niet worden bijgewerkt.",
          ),
        );
        return;
      }
      setEditingTaskId(null);
      router.refresh();
    } catch {
      setError("De verbinding is mislukt.");
    } finally {
      setBusy(false);
    }
  }
  const resultLabel: Record<NonNullable<Task["inspectionResult"]>, string> = {
    PASS: "In orde",
    ATTENTION: "Aandacht",
    FAIL: "Afgekeurd",
    NOT_APPLICABLE: "N.v.t.",
  };
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-lg font-bold text-ink">Werkplaats</h3>
      <div className="mt-3">
        <Notice readiness={readiness} label="Inspectie" />
      </div>
      {error && <p className="mt-3 text-sm text-state-error">{error}</p>}
      <h4 className="mt-5 text-sm font-bold text-ink">Inspectiechecklist</h4>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {checklist.map((task) => (
          <li key={task.id} className="rounded-lg bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{task.description}</strong>
              <span className="text-xs text-ink-faint">
                {task.inspectionResult
                  ? resultLabel[task.inspectionResult]
                  : "Nog niet beoordeeld"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["PASS", "ATTENTION", "FAIL", "NOT_APPLICABLE"] as const).map(
                (result) => (
                  <button
                    key={result}
                    type="button"
                    disabled={busy}
                    onClick={() => update(task.id, true, result)}
                    className="rounded border border-line px-2 py-1 text-xs text-brand-800 disabled:opacity-50"
                  >
                    {resultLabel[result]}
                  </button>
                ),
              )}
              {task.completed && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => update(task.id, false)}
                  className="text-xs text-ink-soft underline"
                >
                  Heropenen
                </button>
          )}
        </div>
          </li>
        ))}
      </ul>
      <h4 className="mt-6 text-sm font-bold text-ink">
        Werkplaatsregel toevoegen
      </h4>
      <form onSubmit={add} className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">
          Werkzaamheid
          <input
            name="description"
            required
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Onderdeel
          <input
            name="partName"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Aantal
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Onderdeelprijs (€)
          <input
            name="partCostEuro"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0.00"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Arbeid (minuten)
          <input
            name="labourMinutes"
            type="number"
            min="0"
            defaultValue="0"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Arbeidskosten (€)
          <input
            name="labourCostEuro"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0.00"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="text-sm text-ink-soft">
          Datum
          <input
            name="doneDate"
            type="date"
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-ink-soft">
          <input name="completed" value="yes" type="checkbox" />
          Direct afronden
        </label>
        <label className="sm:col-span-2 text-sm text-ink-soft">
          Interne opmerkingen
          <textarea
            name="internalNotes"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
          />
        </label>
        <button
          disabled={busy}
          className="w-fit rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-60"
        >
          {busy ? "Opslaan…" : "Werkplaatsregel toevoegen"}
        </button>
      </form>
      {extraTasks.length > 0 && (
        <ul className="mt-5 space-y-2">
          {extraTasks.map((task) => (
            <li key={task.id} className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{task.description}</strong>
                  {task.partName ? ` · ${task.partName}` : ""} · {task.quantity}
                  ×{" "}
                  {task.partCostCents == null
                    ? "—"
                    : formatPrice(task.partCostCents)}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => update(task.id, !task.completed)}
                    className="text-xs text-brand-800 underline"
                  >
                    {task.completed ? "Heropenen" : "Afronden"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setEditingTaskId(
                        editingTaskId === task.id ? null : task.id,
                      )
                    }
                    className="text-xs text-brand-800 underline"
                  >
                    Bewerken
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeTask(task.id)}
                    className="text-xs text-state-error underline"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
              {editingTaskId === task.id && (
                <form
                  onSubmit={(event) => edit(task.id, event)}
                  className="mt-3 grid gap-2 rounded-lg border border-line bg-card p-3 sm:grid-cols-2"
                >
                  <input
                    name="description"
                    required
                    defaultValue={task.description}
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="partName"
                    defaultValue={task.partName ?? ""}
                    placeholder="Onderdeel"
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={task.quantity}
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="partCostEuro"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={(task.partCostCents ?? 0) / 100}
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="labourMinutes"
                    type="number"
                    min="0"
                    defaultValue={task.labourMinutes ?? 0}
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="labourCostEuro"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={(task.labourCostCents ?? 0) / 100}
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <input
                    name="doneDate"
                    type="date"
                    defaultValue={
                      task.doneDate
                        ? new Date(task.doneDate).toISOString().slice(0, 10)
                        : ""
                    }
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      name="completed"
                      value="yes"
                      type="checkbox"
                      defaultChecked={task.completed}
                    />
                    Afgerond
                  </label>
                  <textarea
                    name="internalNotes"
                    rows={2}
                    defaultValue={task.internalNotes ?? ""}
                    className="sm:col-span-2 rounded border border-line px-2 py-1 text-xs"
                  />
                  <button
                    disabled={busy}
                    className="w-fit rounded border border-brand-700 px-2 py-1 text-xs text-brand-800"
                  >
                    Opslaan
                  </button>
                </form>
              )}
              <p className="mt-1 text-xs text-ink-faint">
                {task.labourMinutes ?? 0} min. · arbeid{" "}
                {formatPrice(task.labourCostCents ?? 0)} ·{" "}
                {task.completed
                  ? `afgerond ${formatDate(task.doneDate)}${task.completedBy ? ` door ${task.completedBy.name ?? task.completedBy.email}` : ""}`
                  : "openstaand"}
              </p>
              {task.internalNotes && (
                <p className="mt-1 text-xs text-ink-soft">
                  {task.internalNotes}
                </p>
              )}
              {task.photoKeys.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {task.photoKeys.map((key) => (
                    <Image
                      key={key}
                      src={mediaWidthUrl(key, 120)}
                      alt="Werkplaatsfoto"
                      width={120}
                      height={120}
                      unoptimized
                      className="h-16 w-16 rounded object-cover"
                    />
                  ))}
                </div>
              )}
              <form
                onSubmit={(event) => photos(task.id, event)}
                className="mt-2 flex gap-2"
              >
                <input
                  name="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="text-xs"
                />
                <button
                  disabled={busy}
                  className="text-xs text-brand-800 underline"
                >
                  Foto&apos;s toevoegen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

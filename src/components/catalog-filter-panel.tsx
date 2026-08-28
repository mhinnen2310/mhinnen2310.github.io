import type { FilterOptions } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface FilterState {
  merk: string[];
  type: string[];
  frame: string[];
  wiel: string[];
  motor: string[];
  conditie: string[];
  electric: string;
  prijsmin: string;
  prijsmax: string;
  q: string;
}

function group(name: string, label: string, values: { value: string; label: string }[], active: string[]) {
  if (values.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{label}</legend>
      <div className="space-y-1">
        {values.map((v) => (
          <label key={v.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft hover:text-ink">
            <input
              type="checkbox"
              name={name}
              value={v.value}
              defaultChecked={active.includes(v.value)}
              onChange={() => {}}
              className="h-4 w-4 accent-brand-700"
            />
            {v.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Catalogue filter panel. A plain GET form: the URL is the state, so
 * filters are shareable, bookmarkable and work with zero JavaScript.
 */
export function CatalogFilterPanel({
  options,
  active,
  action = "/fietsen",
}: {
  options: FilterOptions;
  active: FilterState;
  action?: string;
}) {
  const anyFilter =
    active.merk.length + active.type.length + active.frame.length + active.wiel.length +
    active.motor.length + active.conditie.length + (active.electric ? 1 : 0) +
    (active.prijsmin ? 1 : 0) + (active.prijsmax ? 1 : 0);

  return (
    <form method="get" action={action} className="space-y-5">
      {active.q && <input type="hidden" name="q" value={active.q} />}

      {anyFilter > 0 && (
        <a
          href={action}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-brand-50"
        >
          ✕ Filters wissen ({anyFilter})
        </a>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">Elektrisch</legend>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="radio" name="electric" value="ja" defaultChecked={active.electric === "ja"} className="h-4 w-4 accent-brand-700" />
            Elektrische fiets
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="radio" name="electric" value="nee" defaultChecked={active.electric === "nee"} className="h-4 w-4 accent-brand-700" />
            Niet-elektrisch
          </label>
          {active.electric && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input type="radio" name="electric" value="" defaultChecked className="h-4 w-4 accent-brand-700" />
              Beide
            </label>
          )}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prijsmin" className="mb-1.5 block text-sm font-semibold text-ink">
            Prijs van (€)
          </label>
          <input
            id="prijsmin"
            type="number"
            min="0"
            step="10"
            name="prijsmin"
            defaultValue={active.prijsmin || ""}
            placeholder="0"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="prijsmax" className="mb-1.5 block text-sm font-semibold text-ink">
            tot (€)
          </label>
          <input
            id="prijsmax"
            type="number"
            min="0"
            step="10"
            name="prijsmax"
            defaultValue={active.prijsmax || ""}
            placeholder="10000"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
      </div>

      {group("merk", "Merk", options.merken.map((m) => ({ value: m, label: m })), active.merk)}
      {group("type", "Type fiets", options.types.map((t) => ({ value: t, label: capitalize(t) })), active.type)}
      {group("frame", "Framemaat (cm)", options.frames.map((f) => ({ value: String(f), label: `${f} cm` })), active.frame)}
      {group("wiel", "Wielmaat (cm)", options.wielen.map((w) => ({ value: String(w), label: `${w} cm` })), active.wiel)}
      {group("motor", "Motorpositie", options.motoren.map((m) => ({ value: m, label: capitalize(m) })), active.motor)}
      {group("conditie", "Conditie", options.condities.map((c) => ({ value: c, label: c })), active.conditie)}

      <button
        type="submit"
        className={cn("w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800")}
      >
        Toon resultaten
      </button>
    </form>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

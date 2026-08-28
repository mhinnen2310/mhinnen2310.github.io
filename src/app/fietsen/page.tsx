import type { Metadata } from "next";
import Link from "next/link";
import { listBikes, type CatalogParams } from "@/lib/catalog";
import { BikeCard } from "@/components/bike-card";
import { CatalogFilterPanel } from "@/components/catalog-filter-panel";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Beschikbare fietsen",
  description:
    "Bekijk actuele tweedehands elektrische fietsen van Demi Fietsen. Elke fiets is uniek, geïnspecteerd en gereviseerd. Filter op merk, framemaat, actieradius en meer.",
};

export const dynamic = "force-dynamic";

interface Sp {
  q?: string;
  merk?: string;
  type?: string;
  frame?: string;
  electric?: string;
  wiel?: string;
  motor?: string;
  conditie?: string;
  prijsmin?: string;
  prijsmax?: string;
  sort?: string;
  page?: string;
}

function multi(v: string | undefined): string[] {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function toCatalogParams(sp: Sp): CatalogParams {
  return {
    q: sp.q,
    merk: multi(sp.merk),
    type: multi(sp.type),
    frame: multi(sp.frame),
    wiel: multi(sp.wiel),
    motor: multi(sp.motor),
    conditie: multi(sp.conditie),
    electric: sp.electric === "ja" ? "ja" : sp.electric === "nee" ? "nee" : null,
    prijsmin: sp.prijsmin ? Number(sp.prijsmin) : null,
    prijsmax: sp.prijsmax ? Number(sp.prijsmax) : null,
    sort: sp.sort ?? "nieuw",
    page: sp.page ? Number(sp.page) : 1,
  };
}

export default async function CatalogPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const sp: Sp = {
    q: str(raw.q),
    merk: str(raw.merk),
    type: str(raw.type),
    frame: str(raw.frame),
    electric: str(raw.electric),
    wiel: str(raw.wiel),
    motor: str(raw.motor),
    conditie: str(raw.conditie),
    prijsmin: str(raw.prijsmin),
    prijsmax: str(raw.prijsmax),
    sort: str(raw.sort),
    page: str(raw.page),
  };
  const params = toCatalogParams(sp);
  const result = await listBikes(params);

  const sortOptions = [
    { value: "nieuw", label: "Nieuwste eerst" },
    { value: "prijs-asc", label: "Prijs: laag → hoog" },
    { value: "prijs-desc", label: "Prijs: hoog → laag" },
    { value: "frame", label: "Framemaat" },
  ];

  const baseParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "sort" && k !== "page") baseParams[k] = v;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Beschikbare fietsen</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {result.total} {result.total === 1 ? "unieke fiets" : "unieke fietsen"} — elk exemplaar
            apart gefotografeerd, geïnspecteerd en gereviseerd.
          </p>
        </div>
        <form method="get" action="/fietsen" className="flex items-center gap-2">
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          <label htmlFor="sort" className="text-sm text-ink-soft">
            Sorteer op
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={params.sort ?? "nieuw"}
            className="rounded-md border border-line bg-card px-3 py-2 text-sm"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-brand-700 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50">
            Toepassen
          </button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside aria-label="Filters" className="lg:sticky lg:top-20 lg:self-start">
          <details open className="rounded-xl border border-line bg-card p-4 lg:open">
            <summary className="hidden cursor-pointer text-sm font-semibold text-ink lg:hidden">
              Filters
            </summary>
            <div className="mt-3 lg:mt-0">
              <CatalogFilterPanel
                options={result.options}
                active={{
                  merk: params.merk ?? [],
                  type: params.type ?? [],
                  frame: params.frame ?? [],
                  wiel: params.wiel ?? [],
                  motor: params.motor ?? [],
                  conditie: params.conditie ?? [],
                  electric: params.electric ?? "",
                  prijsmin: params.prijsmin?.toString() ?? "",
                  prijsmax: params.prijsmax?.toString() ?? "",
                  q: params.q ?? "",
                }}
              />
            </div>
          </details>
        </aside>

        <section aria-label="Resultaten">
          {result.bikes.length === 0 ? (
            <EmptyState
              title="Geen fietsen gevonden"
              hint="Pas je filters aan of kom later terug — het aanbod verandert snel. Je kunt ook een gewenste fiets opgeven bij een afspraak."
              action={
                <Link
                  href="/afspraak"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Plan een proefrit
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.bikes.map((b) => (
                <BikeCard key={b.id} bike={b} />
              ))}
            </div>
          )}

          <Pagination page={result.page} totalPages={result.totalPages} baseUrl="/fietsen" params={baseParams} />
        </section>
      </div>
    </div>
  );
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

import type { Metadata } from "next";
import { listProducts } from "@/lib/catalog";
import { ProductCard, type ProductView } from "@/components/product-card";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Accessoires & onderdelen",
  description:
    "Fietsaccessoires en onderdelen: verlichting, sluiten, pedals, computers en meer. Direct op voorraad bij Demi Fietsen.",
};

export const dynamic = "force-dynamic";

export default async function AccessoiresPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const q = typeof raw.q === "string" ? raw.q : null;
  const category = typeof raw.category === "string" ? raw.category.split(",").filter(Boolean) : [];
  const sort = typeof raw.sort === "string" ? raw.sort : "nieuw";
  const page = typeof raw.page === "string" ? Number(raw.page) || 1 : 1;

  const result = await listProducts({ q, category, sort, page });

  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;
  if (category.length) baseParams.category = category.join(",");
  if (sort !== "nieuw") baseParams.sort = sort;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Accessoires & onderdelen</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {result.total} {result.total === 1 ? "product" : "producten"} — verlichting, sluiten,
            onderdelen en meer, direct uit voorraad.
          </p>
        </div>
        <form method="get" action="/accessoires" className="flex flex-wrap items-center gap-2">
          <label htmlFor="cat" className="text-sm text-ink-soft">
            Categorie
          </label>
          <select
            id="cat"
            name="category"
            defaultValue={category[0] ?? ""}
            className="rounded-md border border-line bg-card px-3 py-2 text-sm"
          >
            <option value="">Alle</option>
            {result.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label htmlFor="sort" className="text-sm text-ink-soft">
            Sorteer op
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-line bg-card px-3 py-2 text-sm"
          >
            <option value="nieuw">Nieuwste eerst</option>
            <option value="prijs-asc">Prijs: laag → hoog</option>
            <option value="prijs-desc">Prijs: hoog → laag</option>
            <option value="titel">Naam A–Z</option>
          </select>
          <button type="submit" className="rounded-md border border-brand-700 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50">
            Toepassen
          </button>
        </form>
      </div>

      {result.products.length === 0 ? (
        <EmptyState
          title="Geen producten gevonden"
          hint="Pas je filters aan of neem contact met ons op — we kunnen vaak ook specifieke onderdelen bestellen."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.products.map((p) => (
            <ProductCard key={p.id} product={p as ProductView} />
          ))}
        </div>
      )}

      <Pagination page={result.page} totalPages={result.totalPages} baseUrl="/accessoires" params={baseParams} />
    </div>
  );
}

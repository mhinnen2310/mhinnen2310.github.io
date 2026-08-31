import type { Metadata } from "next";
import Link from "next/link";
import { searchStorefront } from "@/lib/search";
import { BikeCard } from "@/components/bike-card";
import { ProductCard, type ProductView } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/badge";

export const metadata: Metadata = {
  title: "Zoeken",
  description: "Zoek fietsen, accessoires en onderdelen bij Demi Fietsen.",
};

export const dynamic = "force-dynamic";

export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const results = q.length >= 2 ? await searchStorefront(q) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Zoeken</h1>

      <form method="get" action="/zoeken" className="mt-4 flex max-w-xl items-center gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Zoekterm
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Bijv. Sparta, 2455, frame 52, licht, slot…"
          className="w-full rounded-lg border border-line bg-card px-4 py-2.5 text-sm placeholder:text-ink-faint"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Zoeken
        </button>
      </form>

      {!results && (
        <p className="mt-6 max-w-md text-sm text-ink-soft">
          Typ minstens twee letters om te zoeken op voorraadstaande fietsen en accessoires — op inventarisnummer,
          merk, model, type en beschrijving.
        </p>
      )}

      {results && results.bikes.length === 0 && results.products.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title={`Geen resultaten voor “${q}”`}
            hint="Probeer een andere zoekterm, of laat het ons weten — we nemen regelmatig nieuwe fietsen en onderdelen aan."
            action={
              <Link
                href="/contact"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Stel je vraag
              </Link>
            }
          />
        </div>
      )}

      {results && results.bikes.length > 0 && (
        <section className="mt-10" aria-labelledby="search-bikes">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="search-bikes" className="text-lg font-semibold text-ink">
              Fietsen
            </h2>
            <Badge tone="gray">{results.bikes.length}</Badge>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.bikes.map((b) => (
              <BikeCard key={b.id} bike={b} showStatus />
            ))}
          </div>
        </section>
      )}

      {results && results.products.length > 0 && (
        <section className="mt-10" aria-labelledby="search-products">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="search-products" className="text-lg font-semibold text-ink">
              Accessoires
            </h2>
            <Badge tone="gray">{results.products.length}</Badge>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.products.map((p) => (
              <ProductCard key={p.id} product={p as unknown as ProductView} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

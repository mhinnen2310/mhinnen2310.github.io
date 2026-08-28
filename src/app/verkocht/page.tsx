import type { Metadata } from "next";
import Link from "next/link";
import { listBikes, type CatalogParams } from "@/lib/catalog";
import { BikeCard } from "@/components/bike-card";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/badge";

export const metadata: Metadata = {
  title: "Verkochte fietsen",
  description:
    "Archief van verkochte tweedehands elektrische fietsen van Demi Fietsen. Elke fiets is een uniek exemplaar — deze is al weg, maar vergelijkbare fietsen staan nog te koop.",
};

export const dynamic = "force-dynamic";

export default async function SoldPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const page = str(raw.page) ? Number(str(raw.page)) : 1;

  const params: CatalogParams = {
    q: str(raw.q),
    merk: str(raw.merk)?.split(",").filter(Boolean),
    sort: str(raw.sort) ?? "nieuw",
    page,
  };
  const result = await listBikes(params, true);

  const baseParams: Record<string, string> = {};
  if (params.q) baseParams.q = params.q;
  if (params.merk?.length) baseParams.merk = params.merk.join(",");
  if (params.sort && params.sort !== "nieuw") baseParams.sort = params.sort;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 max-w-2xl">
        <Badge tone="gray" className="mb-2">
          Archief
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Verkochte fietsen</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Elke fiets die hier staat was een uniek exemplaar en is inmiddels verkocht. We bewaren de
          pagina&apos;s ter historiek — en om te laten zien wat er mogelijk is. Kijk voor actueel aanbod bij{" "}
          <Link href="/fietsen" className="font-medium text-brand-800 underline">
            de beschikbare fietsen
          </Link>
          .
        </p>
      </div>

      {result.bikes.length === 0 ? (
        <EmptyState
          title="Nog geen verkochte fietsen in dit archief"
          hint="Zodra een fiets is verkocht vind je hem hier, met een duidelijke ‘verkocht'-markering."
          action={
            <Link
              href="/fietsen"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Naar het actuele aanbod
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {result.bikes.map((b) => (
            <BikeCard key={b.id} bike={b} showStatus />
          ))}
        </div>
      )}

      <Pagination page={result.page} totalPages={result.totalPages} baseUrl="/verkocht" params={baseParams} />
    </div>
  );
}

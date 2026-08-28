import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Pagina niet gevonden</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Deze pagina bestaat niet (meer)</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        De link kan verouderd zijn — bijvoorbeeld omdat een fiets is verkocht of de pagina is verplaatst.
        Het actuele aanbod vind je hieronder.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/fietsen"
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Bekijk beschikbare fietsen
        </Link>
        <Link
          href="/zoeken"
          className="rounded-lg border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50"
        >
          Zoek in de winkel
        </Link>
      </div>
    </div>
  );
}

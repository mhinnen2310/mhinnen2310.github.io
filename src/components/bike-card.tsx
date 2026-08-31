import Link from "next/link";
import type { BikePublic } from "@/lib/bikes";
import { formatPrice } from "@/lib/utils";
import { mediaSrcSet } from "@/lib/media";
import { Badge } from "./badge";
import { AddToCartButton } from "./add-to-cart-button";

function batterySummary(b: BikePublic): string | null {
  if (b.batteryWh) return `Accu ${b.batteryWh} Wh`;
  if (b.batteryAh && b.batteryVoltage) return `Accu ${b.batteryVoltage}V / ${b.batteryAh} Ah`;
  if (b.batteryAh) return `Accu ${b.batteryAh} Ah`;
  return null;
}

function rangeSummary(b: BikePublic): string | null {
  if (b.rangeMinKm && b.rangeMaxKm) return `ca. ${b.rangeMinKm}–${b.rangeMaxKm} km actieradius`;
  if (b.rangeMaxKm) return `ca. tot ${b.rangeMaxKm} km actieradius`;
  return null;
}

/**
 * Bicycle card (catalogue). Deliberately uncluttered: photo, identity,
 * price, 3–4 key facts, condition, CTA.
 */
export function BikeCard({ bike, showStatus = false }: { bike: BikePublic; showStatus?: boolean }) {
  const isNew = bike.publishedAt
    ? Date.now() - bike.publishedAt.getTime() < 14 * 24 * 3600 * 1000
    : false;
  const specs: string[] = [];
  if (bike.frameSizeCm) specs.push(`${bike.frameSizeCm} cm`);
  if (bike.motorPosition) specs.push(`motor ${bike.motorPosition}`);
  const batt = batterySummary(bike);
  if (batt) specs.push(batt);
  const range = rangeSummary(bike);
  if (range) specs.push(range);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-card transition-shadow hover:shadow-pop">
      <Link href={`/fietsen/${bike.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-surface">
        {bike.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...(() => {
              const s = mediaSrcSet(bike.coverImage);
              return { src: s.src, srcSet: s.srcSet, sizes: s.sizes };
            })()}
            alt={bike.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-ink-faint">
            Foto volgt binnenkort
          </span>
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          {bike.saleLabel && <Badge tone="amber">{bike.saleLabel}</Badge>}
          {!showStatus && isNew && <Badge tone="green">Nieuw in het assortiment</Badge>}
        </div>
        <span className="absolute bottom-2 left-2 rounded-md bg-ink/80 px-2 py-0.5 text-xs font-medium text-white">
          Nr. {bike.inventoryCode}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <Link
            href={`/fietsen/${bike.slug}`}
            className="text-base font-semibold text-ink hover:text-brand-800 hover:underline"
          >
            {bike.brand} {bike.model}
          </Link>
          {showStatus && <BikeStatusLine status={bike.status} />}
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
          {specs.slice(0, 4).map((s) => (
            <li key={s}>{s}</li>
          ))}
          {bike.conditionGrade && <li className="italic">{bike.conditionGrade}</li>}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {bike.previousPriceCents && bike.previousPriceCents > bike.priceCents && (
              <p className="text-xs text-ink-faint line-through">{formatPrice(bike.previousPriceCents)}</p>
            )}
            <p className="text-lg font-bold text-ink">{formatPrice(bike.priceCents)}</p>
          </div>
          {bike.status === "AVAILABLE" ? (
            <div className="flex flex-col items-end gap-1.5">
              <AddToCartButton bikeId={bike.id} label="In winkelwagen" />
              <Link
                href={`/afspraak?fiets=${encodeURIComponent(bike.slug)}`}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Plan een proefrit
              </Link>
            </div>
          ) : bike.status === "SOLD" ? (
            <span className="text-xs font-semibold text-ink-soft">Verkocht</span>
          ) : (
            <span className="text-xs text-ink-faint">Niet te bestellen</span>
          )}
        </div>
      </div>
    </article>
  );
}

function BikeStatusLine({ status }: { status: string }) {
  if (status === "SOLD") return <Badge tone="gray">Deze fiets is verkocht</Badge>;
  if (status === "RESERVED") return <Badge tone="amber">Gereserveerd</Badge>;
  return null;
}

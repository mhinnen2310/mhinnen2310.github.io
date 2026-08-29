import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPublicBikeBySlug } from "@/lib/catalog";
import { pickSimilarBikes } from "@/lib/similar";
import { getWarrantyConfig } from "@/lib/warranty";
import { getDeliveryConfig } from "@/lib/delivery";
import { featureLabel } from "@/lib/bikes";
import { formatPrice } from "@/lib/utils";
import { env } from "@/lib/env";
import { Gallery } from "@/components/gallery";
import { BikeCard } from "@/components/bike-card";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findPublicBikeBySlug(slug);
  if (!found) return { title: "Fiets niet gevonden" };
  const b = found.public;
  const description =
    b.description?.slice(0, 200) ||
    `${b.brand} ${b.model} — tweedehands ${b.isElectric ? "elektrische" : ""} fiets bij Demi Fietsen. Uniek exemplaar, geïnspecteerd en gereviseerd.`;
  const og = b.coverImage
    ? `${env.siteUrl}/api/media/${encodeURIComponent(b.coverImage)}/w-1200.webp`
    : null;
  return {
    title: `${b.brand} ${b.model} (${b.inventoryCode})`,
    description,
    alternates: { canonical: `/fietsen/${b.slug}` },
    openGraph: {
      title: `${b.brand} ${b.model} — ${formatPrice(b.priceCents)}`,
      description,
      type: "website",
      locale: "nl_NL",
      ...(og ? { images: [{ url: og, width: 1200, height: 900 }] } : {}),
    },
  };
}

export default async function BikePage({ params }: Props) {
  const { slug } = await params;
  const found = await findPublicBikeBySlug(slug);
  if (!found) notFound();

  const bike = found.public;
  const isSold = bike.status === "SOLD";
  const isReserved = bike.status === "RESERVED";
  const isAvailable = bike.status === "AVAILABLE";

  const [warranty, delivery, similar] = await Promise.all([
    getWarrantyConfig(),
    getDeliveryConfig(),
    isSold ? pickSimilarBikes(bike, 4) : pickSimilarBikes(bike, 3),
  ]);

  // ---- Structured data (valid schema.org; no fake reviews) ----------------
  const abs = (p: string) => `${env.siteUrl}${p}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${bike.brand} ${bike.model}`,
    description:
      bike.description ?? `${bike.brand} ${bike.model}, tweedehands ${bike.isElectric ? "elektrische" : ""} fiets`,
    sku: bike.inventoryCode,
    brand: { "@type": "Brand", name: bike.brand },
    model: bike.model,
    ...(bike.colour ? { color: bike.colour } : {}),
    ...(found.images.length
      ? {
          image: found.images.map((i) =>
            abs(`/api/media/${encodeURIComponent(i.key)}/w-1200.webp`),
          ),
        }
      : {}),
    condition: "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: abs(`/fietsen/${bike.slug}`),
      priceCurrency: "EUR",
      price: (bike.priceCents / 100).toFixed(2),
      availability: isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: abs("/") },
      { "@type": "ListItem", position: 2, name: "Fietsen", item: abs("/fietsen") },
      { "@type": "ListItem", position: 3, name: `${bike.brand} ${bike.model}` },
    ],
  };

  const specs: [string, string][] = [];
  if (bike.bikeType) specs.push(["Type", bike.bikeType]);
  specs.push(["Elektrisch", bike.isElectric ? "Ja" : "Nee"]);
  if (bike.colour) specs.push(["Kleur", bike.colour]);
  if (bike.frameSizeCm) specs.push(["Framemaat", `${bike.frameSizeCm} cm`]);
  if (bike.wheelSizeInches) specs.push(["Wielmaat", `${bike.wheelSizeInches}"`]);
  if (bike.gears) specs.push(["Versnellingen", `${bike.gears}`]);
  if (bike.assistanceLevels) specs.push(["Ondersteuningsniveaus", `${bike.assistanceLevels}`]);
  if (bike.brakeInfo) specs.push(["Remmen", bike.brakeInfo]);
  if (bike.drivetrainInfo) specs.push(["Transmissie", bike.drivetrainInfo]);

  const electric: [string, string][] = [];
  if (bike.motorManufacturer || bike.motorModel)
    electric.push(["Motor", [bike.motorManufacturer, bike.motorModel].filter(Boolean).join(" ")]);
  if (bike.motorPosition) electric.push(["Motorpositie", bike.motorPosition]);
  if (bike.motorDescription) electric.push(["Motorinfo", bike.motorDescription]);
  if (bike.nominalVoltage) electric.push(["Spanning", `${bike.nominalVoltage} V`]);
  if (bike.walkAssist != null) electric.push(["Loopassistentie", bike.walkAssist ? "Ja" : "Nee"]);
  if (bike.electricalNotes) electric.push(["Overig", bike.electricalNotes]);

  const battery: [string, string][] = [];
  if (bike.batteryType) battery.push(["Accutype", bike.batteryType]);
  if (bike.batteryVoltage) battery.push(["Spanning", `${bike.batteryVoltage} V`]);
  if (bike.batteryAh) battery.push(["Capaciteit", `${bike.batteryAh} Ah`]);
  if (bike.batteryWh) battery.push(["Energie", `${bike.batteryWh} Wh`]);
  if (bike.batteryCondition) battery.push(["Accu-stand", bike.batteryCondition]);
  if (bike.batteryReconditioned != null)
    battery.push(["Gereviseerde accu", bike.batteryReconditioned ? "Ja" : "Nee"]);
  const range =
    bike.rangeMinKm && bike.rangeMaxKm
      ? `${bike.rangeMinKm}–${bike.rangeMaxKm} km`
      : bike.rangeMaxKm
        ? `tot ca. ${bike.rangeMaxKm} km`
        : null;
  if (range) battery.push(["Geschatte actieradius", range]);

  const deliveryMethods = delivery.methods.filter((m) => m.enabled);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumbs */}
        <nav aria-label="Kruimelpad" className="mb-4 text-sm text-ink-faint">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-brand-700 hover:underline">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/fietsen" className="hover:text-brand-700 hover:underline">Fietsen</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-ink">{bike.brand} {bike.model}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* Gallery */}
          <div>
            {found.images.length > 0 ? (
              <Gallery images={found.images} title={bike.title} />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line bg-surface">
                <p className="text-sm text-ink-faint">Nog geen foto’s beschikbaar</p>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              Elke tweedehands fiets bij Demi Fietsen is een uniek exemplaar. De foto’s en
              specificaties op deze pagina horen bij deze specifieke fiets.
            </p>
          </div>

          {/* Primary info */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-surface px-2 py-1 font-mono text-xs font-medium text-ink-soft">
                Nr. {bike.inventoryCode}
              </span>
              {bike.saleLabel && <Badge tone="amber">{bike.saleLabel}</Badge>}
              {isAvailable && <Badge tone="green">Beschikbaar</Badge>}
              {isReserved && <Badge tone="amber">Gereserveerd</Badge>}
              {isSold && <Badge tone="gray">Verkocht</Badge>}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {bike.brand} {bike.model}
            </h1>
            {bike.title && bike.title !== `${bike.brand} ${bike.model}` && (
              <p className="mt-1 text-sm text-ink-soft">{bike.title}</p>
            )}

            <div className="mt-4 flex items-baseline gap-3">
              <p className="text-3xl font-bold text-ink">{formatPrice(bike.priceCents)}</p>
              {bike.previousPriceCents != null && bike.previousPriceCents > bike.priceCents && (
                <p className="text-base text-ink-faint line-through">
                  {formatPrice(bike.previousPriceCents)}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-faint">Vraagprijs, inclusief btw indien van toepassing.</p>

            {/* CTAs */}
            <div className="mt-6 space-y-3">
              {isAvailable && (
                <>
                  <div>
                    <AddToCartButton bikeId={bike.id} size="lg" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/afspraak?fiets=${encodeURIComponent(bike.id)}`}
                      className="rounded-lg border border-brand-300 bg-card px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                    >
                      Plan een proefrit
                    </Link>
                    <Link
                      href={`/contact?fiets=${encodeURIComponent(bike.inventoryCode)}`}
                      className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface"
                    >
                      Stel een vraag
                    </Link>
                  </div>
                </>
              )}
              {isReserved && (
                <div role="status" className="rounded-lg border border-accent-500/30 bg-accent-50 px-4 py-3 text-sm text-accent-700">
                  <strong>Deze fiets is momenteel gereserveerd.</strong> Er wordt net over
                  onderhandeld of er wordt afgerekend. Wil je hem graag? Bel of mail ons — we
                  laten direct weten of hij nog te hebben is.
                </div>
              )}
              {isSold && (
                <div role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
                  <strong className="font-semibold text-ink">Deze fiets is verkocht.</strong>{" "}
                  Elke fiets is een uniek exemplaar, dus deze exacte fiets is niet meer te koop.
                  Onderaan deze pagina staan vergelijkbare fietsen die nu beschikbaar zijn.
                </div>
              )}
              {!isAvailable && !isReserved && !isSold && (
                <div role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
                  Deze fiets is momenteel niet beschikbaar.
                </div>
              )}

              {warranty.enabled && (
                <p className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
                  <strong className="font-semibold">Garantie: </strong>
                  {warranty.publicNote}
                </p>
              )}
            </div>

            {/* Quick specs */}
            {specs.length > 0 && (
              <dl className="mt-6 overflow-hidden rounded-xl border border-line">
                <div className="bg-surface px-4 py-2.5 text-sm font-semibold text-ink">Specificaties</div>
                <div className="divide-y divide-line bg-card">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2 text-sm">
                      <dt className="text-ink-soft">{k}</dt>
                      <dd className="text-right font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </div>
              </dl>
            )}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Section title="Conditie">
            <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
              {bike.conditionGrade && (
                <p>
                  <strong className="font-semibold text-ink">Conditie: </strong>
                  {bike.conditionGrade} — dit is een tweedehands artikel.
                </p>
              )}
              {bike.conditionDescription && <p>{bike.conditionDescription}</p>}
              {bike.cosmeticDefects && (
                <p>
                  <strong className="font-semibold text-ink">Kleine gebreken: </strong>
                  {bike.cosmeticDefects}
                </p>
              )}
              {bike.technicalDefects && (
                <p>
                  <strong className="font-semibold text-ink">Technisch: </strong>
                  {bike.technicalDefects}
                </p>
              )}
              {!bike.conditionGrade && !bike.conditionDescription && !bike.cosmeticDefects && !bike.technicalDefects && (
                <p className="text-ink-faint">Geen specifieke condienotities bijgehouden.</p>
              )}
            </div>
          </Section>

          {bike.isElectric && (
            <>
              {electric.length > 0 && (
                <Section title="Elektrisch systeem">
                  <dl className="divide-y divide-line text-sm">
                    {electric.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2">
                        <dt className="text-ink-soft">{k}</dt>
                        <dd className="text-right font-medium text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>
              )}
              {battery.length > 0 && (
                <Section title="Accu">
                  <dl className="divide-y divide-line text-sm">
                    {battery.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2">
                        <dt className="text-ink-soft">{k}</dt>
                        <dd className="text-right font-medium text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {range && (
                    <p className="mt-2 text-xs text-ink-faint">
                      De actieradius is een schatting op basis van het type accu en gebruik;
                      windsnelheid, heuvels en ondersteuningsniveau beïnvloeden de werkelijke
                      actieradius.
                    </p>
                  )}
                </Section>
              )}
            </>
          )}

          {bike.features.length > 0 && (
            <Section title="Inbegrepen & extra’s">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {bike.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink-soft">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 text-brand-600">
                      <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {featureLabel(f)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {bike.repairSummary && (
            <Section title="Inspectie & revisie">
              <p className="text-sm leading-relaxed text-ink-soft">{bike.repairSummary}</p>
            </Section>
          )}

          <Section title="Ophalen & bezorgen">
            <ul className="space-y-2 text-sm text-ink-soft">
              {deliveryMethods.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-4">
                  <span>
                    {m.label}
                    {m.instructions && <span className="block text-xs text-ink-faint">{m.instructions}</span>}
                  </span>
                  <span className="shrink-0 font-medium text-ink">
                    {m.priceCents === 0 ? "Gratis" : formatPrice(m.priceCents)}
                  </span>
                </li>
              ))}
              {deliveryMethods.length === 0 && (
                <li className="text-ink-faint">Neem voor leveropties contact met ons op.</li>
              )}
            </ul>
          </Section>
        </div>

        {/* Description */}
        {bike.description && (
          <section className="mt-8 rounded-xl border border-line bg-card p-6" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-lg font-semibold text-ink">Over deze fiets</h2>
            <div className="prose-plain mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
              {bike.description.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Similar bikes */}
        {similar.length > 0 && (
          <section className="mt-10" aria-labelledby="similar-heading">
            <h2 id="similar-heading" className="text-xl font-semibold tracking-tight text-ink">
              {isSold ? "Beschikbare alternatieven" : "Verwacht je iets vergelijkbaars?"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {isSold
                ? "Deze exacte fiets is verkocht. Hieronder staan fietsen die op dit moment beschikbaar zijn en qua maat, type en prijs in de buurt zitten."
                : "Misschien past er wel iets anders bij je."}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((b) => (
                <BikeCard key={b.id} bike={b} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5" aria-label={title}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

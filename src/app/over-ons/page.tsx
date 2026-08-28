import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getWarrantyConfig } from "@/lib/warranty";

export const metadata: Metadata = {
  title: "Over Demi Fietsen",
  description:
    "Demi Fietsen koopt tweedehands elektrische fietsen in, inspecteert en reviseert ze in eigen werkplaats en verkoopt elk uniek exemplaar met garantie.",
};

export default async function OverOnsPage() {
  const settings = await getSettings();
  const warranty = await getWarrantyConfig();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Over {settings.companyName}</h1>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">
        {settings.aboutText ? (
          settings.aboutText.split("\n\n").map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <>
            <p>
              {settings.companyName} is een lokale fietsenspeciaalzaak met een eenvoudige gedachte: goede
              tweedehands elektrische fietsen, eerlijk geprijsd en klaar om direct te rijden.
            </p>
            <p>
              Elke fiets die we verkopen is een uniek exemplaar. We nemen de fiets in, inspecteren en reviseren
              hem in eigen werkplaats, controleren de accu en het elektrische systeem, en fotografieren het
              exemplaar zoals het bij ons staat. Wat je op de website ziet, is exact de fiets die je kunt kopen.
            </p>
            <p>
              Omdat we zelf de hele fiets kennen — inclusief wat er al aan is gedaan — kunnen we ook eerlijk
              vertellen over de staat van accu en onderdelen, en geven we waar van toepassing garantie.
            </p>
          </>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-card p-5" aria-labelledby="warranty-heading">
        <h2 id="warranty-heading" className="text-base font-semibold text-ink">
          Garantie
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {warranty.enabled
            ? "Op de fietsen die we verkopen zit garantie; de exacte omvang (fiets, accu en/of elektrisch systeem) wordt bij elke verkoop vastgelegd en staat vermeld bij de betreffende fiets of bestelling."
            : "Garantievoorwaarden worden per fiets vastgelegd en staan vermeld op de fietspagina en bij je bestelling."}
        </p>
        <p className="mt-2 text-sm text-ink-faint">
          De definitieve garantie- en voorwaardensteksten worden vóór livegang door een juridisch professional
          gecontroleerd.
        </p>
      </section>

      {settings.addressLine && (
        <section className="mt-8" aria-labelledby="locatie-heading">
          <h2 id="locatie-heading" className="text-base font-semibold text-ink">
            Zo vind je ons
          </h2>
          <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
            {settings.addressLine}
            <br />
            {[settings.postcode, settings.city].filter(Boolean).join(" ")}
            {settings.phone && (
              <>
                <br />
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-brand-800 underline">
                  {settings.phone}
                </a>
              </>
            )}
          </address>
          {settings.openingHours.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {settings.openingHours.map((o) => (
                <li key={o.days}>
                  {o.days}: {o.hours}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/fietsen"
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Bekijk beschikbare fietsen
        </Link>
        <Link
          href="/afspraak"
          className="rounded-lg border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50"
        >
          Plan een proefrit
        </Link>
      </div>
    </div>
  );
}

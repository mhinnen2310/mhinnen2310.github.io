import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { latestAvailableBikes } from "@/lib/catalog";
import { getWarrantyConfig } from "@/lib/warranty";
import { BikeCard } from "@/components/bike-card";
import { mediaWidthUrl } from "@/lib/media";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: "Tweedehands elektrische fietsen met garantie",
    description:
      "Demi Fietsen verkoopt unieke tweedehands e-bikes: geïnspecteerd, gereviseerd en met garantie. Bekijk het actuele aanbod en plan een proefrit.",
    alternates: { canonical: "/" },
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, bikes, warranty] = await Promise.all([
    getSettings(),
    latestAvailableBikes(8),
    getWarrantyConfig(),
  ]);

  const heroBike = bikes.find((b) => b.coverImage) ?? null;
  const heroTitle =
    settings.homepage.heroTitle ||
    "Tweedehands e-bikes. Unieke fietsen, eerlijke prijzen, met garantie.";
  const heroSubtitle =
    settings.homepage.heroSubtitle ||
    "Elke fiets is een uniek exemplaar: persoonlijk geïnspecteerd, gereviseerd en met een gereviseerde accu waar van toepassing. Kom proefrijden of koop direct online.";

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section
        className="border-b border-line bg-card"
        aria-labelledby="hero-heading"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-brand-600"
              />
              {bikes.length > 0
                ? `${bikes.length} unieke e-bikes nu beschikbaar`
                : "Dagelijks nieuwe fietsen"}
            </p>
            <h1
              id="hero-heading"
              className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-soft">
              {heroSubtitle}
            </p>
            {settings.homepage.intro && (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
                {settings.homepage.intro}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/fietsen"
                className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              >
                {settings.homepage.primaryCta || "Bekijk beschikbare fietsen"}
              </Link>
              <Link
                href="/afspraak"
                className="rounded-lg border border-brand-300 bg-card px-5 py-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50"
              >
                {settings.homepage.secondaryCta || "Plan een proefrit"}
              </Link>
            </div>
          </div>
          <div className="relative">
            {heroBike?.coverImage ? (
              <Link
                href={`/fietsen/${heroBike.slug}`}
                className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
                aria-label={`Bekijk ${heroBike.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaWidthUrl(heroBike.coverImage, 1200)}
                  alt={heroBike.title}
                  width={1200}
                  height={900}
                  className="aspect-[4/3] w-full object-cover"
                />
              </Link>
            ) : (
              <div
                className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-line bg-brand-50"
                role="img"
                aria-label="Demi Fietsen"
              >
                <BikeIcon />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Why us */}
      {settings.homepage.showWhyUs && (
        <section
          aria-labelledby="why-heading"
          className="mx-auto max-w-6xl px-4"
        >
          <h2
            id="why-heading"
            className="text-xl font-semibold tracking-tight text-ink"
          >
            Waarom een tweedehands e-bike bij Demi Fietsen?
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ValueProp
              title="Geïnspecteerd en gereviseerd"
              body="Elke fiets krijgt een complete inspectie en reparatie voordat hij te koop staat. Schade en slijtage melden we eerlijk op de fietspagina."
            />
            <ValueProp
              title="Accuexpertise"
              body="Elektrische fietsen krijgen waar van toepassing een gereviseerde accu, met garantie op de accu. De exacte omvang staat bij elke fiets."
            />
            <ValueProp
              title="Lokaal en persoonlijk"
              body="Je ziet en proefrijdt de fiets voor je koopt. Vragen over een onderwerp? Bel of mail ons — je krijgt een menselijk antwoord."
            />
          </div>
          {warranty.enabled && (
            <p className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-sm text-ink-soft">
              <strong className="font-semibold text-ink">
                {warranty.title}:{" "}
              </strong>
              {warranty.publicNote}
            </p>
          )}
        </section>
      )}

      {/* Current inventory */}
      {settings.homepage.showRecentlyAdded && (
        <section
          aria-labelledby="stock-heading"
          className="mx-auto max-w-6xl px-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="stock-heading"
                className="text-xl font-semibold tracking-tight text-ink"
              >
                Nu beschikbaar
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Elke fiets is uniek: de foto’s en specificaties horen bij deze
                specifieke fiets.
              </p>
            </div>
            <Link
              href="/fietsen"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            >
              Bekijk het volledige aanbod →
            </Link>
          </div>
          {bikes.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-line bg-card px-6 py-10 text-center">
              <p className="text-base font-semibold text-ink">
                Op dit moment geen fietsen online
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Er komen regelmatig nieuwe fietsen binnen. Kom langs of bel even
                — misschien is er iets wat nog niet online staat.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/contact"
                  className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
                >
                  Neem contact op
                </Link>
                <Link
                  href="/afspraak"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  Plan een proefrit
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {bikes.map((b) => (
                <BikeCard key={b.id} bike={b} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* How it works */}
      {settings.homepage.showHowItWorks && (
        <section
          aria-labelledby="how-heading"
          className="border-y border-line bg-card"
        >
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h2
              id="how-heading"
              className="text-xl font-semibold tracking-tight text-ink"
            >
              Zo werkt het
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Vind je fiets",
                  body: "Blader door het actuele aanbod en bekijk de specificaties van elke unieke fiets.",
                },
                {
                  step: "2",
                  title: "Bekijk & proefrijd",
                  body: "Maak een afspraak en rijd op de fiets die je ziet — precies dit exemplaar.",
                },
                {
                  step: "3",
                  title: "Koop of reserveer",
                  body: "Bestel online of koop direct bij ophaling. Betaal veilig met iDEAL of creditcard.",
                },
                {
                  step: "4",
                  title: "Ophalen of leveren",
                  body: "Haal je fiets bij ons op of laat hem bezorgen. Met factuur en garantie.",
                },
              ].map((s) => (
                <li
                  key={s.step}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white"
                  >
                    {s.step}
                  </span>
                  <p className="mt-3 font-semibold text-ink">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* About teaser */}
      <section
        aria-labelledby="about-heading"
        className="mx-auto max-w-6xl px-4"
      >
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-brand-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <h2
              id="about-heading"
              className="text-xl font-semibold tracking-tight text-brand-900"
            >
              Over Demi Fietsen
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-800">
              {settings.aboutText ??
                "Demi Fietsen is een lokale fietsenwinkel gespecialiseerd in tweedehands elektrische fietsen. We verzamelen unieke e-bikes, brengen ze in topconditie en verkopen ze met garantie — tegen een eerlijke prijs."}
            </p>
          </div>
          <Link
            href="/over-ons"
            className="shrink-0 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Lees meer over ons
          </Link>
        </div>
      </section>

      {/* Newsletter */}
      {settings.newsletterEnabled && (
        <section
          aria-labelledby="news-heading"
          className="mx-auto max-w-6xl px-4"
        >
          <div className="rounded-2xl border border-line bg-card p-6 sm:p-8">
            <h2 id="news-heading" className="text-lg font-semibold text-ink">
              Nieuwste fietsen eerst in je inbox
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-soft">
              We mailen alleen wanneer er iets nieuws binnenkomt. Geen spam, en
              afmelden kan met één klik.
            </p>
            <Link
              href="/nieuwsbrief"
              className="mt-4 inline-block rounded-lg border border-brand-300 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              Schrijf je in voor de nieuwsbrief
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function BikeIcon() {
  return (
    <svg
      width="120"
      height="90"
      viewBox="0 0 120 90"
      fill="none"
      aria-hidden
      className="text-brand-600"
    >
      <circle cx="28" cy="62" r="20" stroke="currentColor" strokeWidth="4" />
      <circle cx="92" cy="62" r="20" stroke="currentColor" strokeWidth="4" />
      <path
        d="M28 62L48 30h24l20 32M48 30l12 32h-8M72 30l-12 32M40 22h16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { PostForm } from "@/components/post-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Neem contact op met Demi Fietsen — voor vragen over fietsen, bestellingen, garantie of service.",
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Contact</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Een vraag over een fiets, bestelling of garantie? Vul het formulier in — we reageren meestal
            binnen één werkdag.
          </p>

          <div className="mt-6 max-w-xl">
            <PostForm
              action="/api/contact"
              submitLabel="Vraag versturen"
              successTitle="Bericht ontvangen"
              successBody="Dank je wel! We nemen zo snel mogelijk contact met je op."
              fields={[
                { name: "name", label: "Naam", type: "text", required: true, autoComplete: "name" },
                { name: "email", label: "E-mailadres", type: "email", required: true, autoComplete: "email" },
                { name: "phone", label: "Telefoon (optioneel)", type: "tel", autoComplete: "tel" },
                { name: "subject", label: "Onderwerp (optioneel)", type: "text" },
                {
                  name: "message",
                  label: "Bericht",
                  type: "textarea",
                  required: true,
                  rows: 6,
                  placeholder: "Waar kunnen we je mee helpen?",
                },
              ]}
            />
          </div>

          <div className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-card p-4">
              <p className="font-semibold text-ink">Retour, garantie of service?</p>
              <p className="mt-1 text-ink-soft">Gebruik dan het daarvoor bestemde formulier.</p>
              <Link
                href="/service"
                className="mt-2 inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-brand-50"
              >
                Naar het formulier
              </Link>
            </div>
            <div className="rounded-xl border border-line bg-card p-4">
              <p className="font-semibold text-ink">Een fiets bekijken?</p>
              <p className="mt-1 text-ink-soft">Plan een proefrit, dan is de fiets voor je klaar.</p>
              <Link
                href="/afspraak"
                className="mt-2 inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-brand-50"
              >
                Plan een proefrit
              </Link>
            </div>
          </div>
        </div>

        <aside aria-label="Contactgegevens" className="space-y-4">
          <div className="rounded-xl border border-line bg-card p-5 text-sm">
            <p className="font-semibold text-ink">{settings.companyName}</p>
            <address className="mt-2 not-italic leading-relaxed text-ink-soft">
              {settings.addressLine && (
                <>
                  {settings.addressLine}
                  <br />
                </>
              )}
              {(settings.postcode || settings.city) && (
                <>
                  {[settings.postcode, settings.city].filter(Boolean).join(" ")}
                  <br />
                </>
              )}
              {settings.phone && (
                <>
                  <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-brand-800 underline">
                    {settings.phone}
                  </a>
                  <br />
                </>
              )}
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="text-brand-800 underline">
                  {settings.email}
                </a>
              )}
            </address>
            {settings.openingHours.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-ink-soft">
                {settings.openingHours.map((o) => (
                  <li key={o.days}>
                    {o.days}: {o.hours}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {(settings.kvkNumber || settings.vatId) && (
            <div className="rounded-xl border border-line bg-card p-5 text-xs text-ink-faint">
              {settings.kvkNumber && <p>KvK {settings.kvkNumber}</p>}
              {settings.vatId && <p>{settings.vatId}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

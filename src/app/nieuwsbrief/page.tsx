import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { PostForm } from "@/components/post-form";

export const metadata: Metadata = {
  title: "Nieuwsbrief",
  description: "Schrijf je in voor de nieuwsbrief van Demi Fietsen — nieuwe fietsen en nieuws, zonder spam.",
};

export const dynamic = "force-dynamic";

export default async function NieuwsbriefPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Nieuwsbrief</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Nieuwe fietsen in het assortiment, tips en af en toe een actie. Maximaal 1× per maand, geen
        ongevraagde spam. Je kunt je op elk moment afmelden met de link in de e-mail.
      </p>

      {settings.newsletterEnabled ? (
        <div className="mt-6">
          <PostForm
            action="/api/newsletter"
            submitLabel="Inschrijven"
            successTitle="Je staat op de nieuwsbrief"
            successBody="Je kunt je op elk moment afmelden met de link in de e-mail."
            fields={[
              { name: "email", label: "E-mailadres", type: "email", required: true, autoComplete: "email" },
            ]}
          />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-card p-4 text-sm text-ink-soft">
          De nieuwsbrief is momenteel niet open voor nieuwe inschrijvingen.
        </p>
      )}
    </div>
  );
}

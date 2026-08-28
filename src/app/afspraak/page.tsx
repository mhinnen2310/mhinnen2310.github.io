import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TIME_BLOCKS } from "@/lib/forms";
import { PostForm } from "@/components/post-form";
import { Badge } from "@/components/badge";

export const metadata: Metadata = {
  title: "Proefrit & afspraak",
  description:
    "Plan een proefrit bij Demi Fietsen. Kies de fiets, een datum en een tijdslot — we bevestigen de afspraak per e-mail of telefoon.",
};

export const dynamic = "force-dynamic";

/**
 * Appointment (proefrit) request workflow (spec 17).
 *
 * This is a REQUEST, not a guaranteed booking: admin confirms via the
 * Admin panel (NEW -> CONTACTED -> CONFIRMED ...). Optionally preselects
 * a bike via ?fiets=<slug> (from bike cards / product page).
 */
export default async function AfspraakPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const fietsSlug = typeof raw.fiets === "string" ? raw.fiets : null;

  let bike: { id: string; title: string; inventoryCode: string; status: string } | null = null;
  if (fietsSlug) {
    const found = await prisma.bike.findUnique({
      where: { slug: fietsSlug },
      select: { id: true, title: true, inventoryCode: true, status: true },
    });
    bike = found ? { id: found.id, title: found.title, inventoryCode: found.inventoryCode, status: found.status } : null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  const max = maxDate.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Plan een proefrit of afspraak</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Kom langs, bekijk de fiets op rust en maak een proefrit. Vul het formulier in; we nemen contact met
        je op om de afspraak te bevestigen.
      </p>

      {bike && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <Badge tone={bike.status === "AVAILABLE" ? "green" : "gray"}>
            {bike.status === "AVAILABLE" ? "Beschikbaar" : "Status: " + bike.status}
          </Badge>
          <p className="text-sm text-brand-900">
            <span className="font-semibold">Fiets meegenomen:</span> {bike.title} (nr. {bike.inventoryCode})
          </p>
        </div>
      )}

      <div className="mt-6">
        <PostForm
          action="/api/appointments"
          submitLabel="Aanvraag versturen"
          successTitle="Aanvraag ontvangen"
          successBody="We nemen zo snel mogelijk contact met je op om de afspraak te bevestigen. Je ontvangt geen bevestiging per direct — de aanvraag is een verzoek, geen gegarandeerde booking."
          extra={bike ? { bikeId: bike.id } : undefined}
          fields={[
            { name: "name", label: "Naam", type: "text", required: true, autoComplete: "name" },
            { name: "email", label: "E-mailadres", type: "email", required: true, autoComplete: "email" },
            { name: "phone", label: "Telefoon (optioneel)", type: "tel", autoComplete: "tel" },
            {
              name: "preferredDate",
              label: "Gewenste datum",
              type: "date",
              required: true,
              min: today,
              max,
            },
            {
              name: "timeBlock",
              label: "Tijdslot",
              type: "select",
              required: true,
              options: TIME_BLOCKS.map((t) => ({ value: t, label: t })),
            },
            {
              name: "message",
              label: "Bericht (optioneel)",
              type: "textarea",
              rows: 4,
              placeholder:
                bike
                  ? "Vraag over deze fiets, gewenste route, …"
                  : "Welke fiets wil je bekijken? Wat is je vraag?",
            },
          ]}
        />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Liever direct contact? <Link href="/contact" className="underline">Stel een vraag</Link> of bel
        ons.
      </p>
    </div>
  );
}

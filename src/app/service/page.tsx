import type { Metadata } from "next";
import Link from "next/link";
import { PostForm } from "@/components/post-form";

export const metadata: Metadata = {
  title: "Retour, garantie & service",
  description:
    "Een retour, garantie- of serviceverzoek indienen bij Demi Fietsen. Verklare het probleem, voeg eventueel foto's toe — we beoordelen elk verzoek per geval.",
};

export const dynamic = "force-dynamic";

const SERVICE_TYPE_OPTIONS = [
  { value: "RETURN", label: "Retour / omruiling" },
  { value: "WARRANTY", label: "Garantie-claim" },
  { value: "SERVICE", label: "Service / probleem met de fiets" },
  { value: "DAMAGE", label: "Beschadigd ontvangen / vervoer" },
  { value: "OTHER", label: "Andere kwestie" },
];

/**
 * Returns / warranty / service request workflow (spec 19).
 *
 * Submitting a request does NOT automatically create any entitlement —
 * eligibility is a business decision made in Admin. Optional photos are
 * uploaded as multipart/form-data through the standard image pipeline.
 *
 * ?order=<orderNumber> preselects the order (from account / order-status).
 */
export default async function ServicePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const order = typeof raw.order === "string" ? raw.order : null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Retour, garantie & service</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Iets met je fiets of bestelling? Verklare het hieronder en voeg eventueel foto&apos;s toe. We beoordelen
        elk verzoek per geval en nemen contact met je op — het indienen van een verzoek is nog geen
        toezegging.
      </p>

      <div className="mt-6">
        <PostForm
          action="/api/service-requests"
          multipart
          submitLabel="Verzoek versturen"
          successTitle="Verzoek ontvangen"
          successBody="We hebben je verzoek binnen. Na beoordeling nemen we contact met je op. Houd je bestelnummer bij de hand."
          fields={[
            {
              name: "type",
              label: "Type verzoek",
              type: "select",
              required: true,
              options: SERVICE_TYPE_OPTIONS,
            },
            {
              name: "orderNumber",
              label: "Bestelnummer / factuurnummer (indien van toepassing)",
              type: "text",
              initial: order ?? undefined,
              placeholder: "DF-2026-000001",
              hint: "Zoek je bestelnummer via e-mail of in je account.",
            },
            { name: "name", label: "Naam", type: "text", required: true, autoComplete: "name" },
            { name: "email", label: "E-mailadres", type: "email", required: true, autoComplete: "email" },
            { name: "phone", label: "Telefoon (optioneel)", type: "tel", autoComplete: "tel" },
            {
              name: "description",
              label: "Beschrijf het probleem",
              type: "textarea",
              required: true,
              rows: 6,
              placeholder: "Wat is er aan de hand? Sinds wanneer? Wat heb je al geprobeerd?",
            },
            {
              name: "photos",
              label: "Foto's (optioneel, max. 4 stuks à 10 MB)",
              type: "file",
              multiple: true,
              accept: "image/*",
            },
          ]}
        />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        De garantieomvang van je fiets staat vermeld bij de fiets/bestelling. Algemene informatie:{" "}
        <Link href="/retourbeleid" className="underline">
          retour- en garantiebeleid
        </Link>
        .
      </p>
    </div>
  );
}

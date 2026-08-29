import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppointmentRequestForm } from "@/components/appointment-request-form";
import { getAppointmentAvailability } from "@/lib/appointment-availability";
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

  const availability = await getAppointmentAvailability(90);

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
        <AppointmentRequestForm availability={availability} bikeId={bike?.id} />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Liever direct contact? <Link href="/contact" className="underline">Stel een vraag</Link> of bel
        ons.
      </p>
    </div>
  );
}

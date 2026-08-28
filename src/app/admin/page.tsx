import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [bikes, pendingOrders, lowStock, appointments, serviceRequests, messages] = await Promise.all([
    prisma.bike.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { paymentStatus: "PENDING" } }),
    prisma.product.count({ where: { active: true, stockQuantity: { lte: 3 } } }),
    prisma.appointment.count({ where: { status: "NEW" } }),
    prisma.serviceRequest.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  const bikeTotal = bikes.reduce((sum, row) => sum + row._count._all, 0);
  const available = bikes.find((row) => row.status === "AVAILABLE")?._count._all ?? 0;

  const metrics = [
    { label: "Fietsen in voorraad", value: bikeTotal, hint: `${available} beschikbaar`, href: "/admin/fietsen" },
    { label: "Openstaande betalingen", value: pendingOrders, hint: "Controleer betaling en reserveringen", href: "/admin/bestellingen" },
    { label: "Lage accessoirevoorraad", value: lowStock, hint: "Actieve artikelen met 3 of minder stuks", href: "/admin/accessoires" },
    { label: "Nieuwe afspraken", value: appointments, hint: "Nog te behandelen", href: "/admin/afspraken" },
    { label: "Nieuwe serviceverzoeken", value: serviceRequests, hint: "Nog te behandelen", href: "/admin/service" },
    { label: "Nieuwe berichten", value: messages, hint: "Nog te beantwoorden", href: "/admin/berichten" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Overzicht</h2>
          <p className="mt-1 text-sm text-ink-soft">Dagelijkse voorraad- en klantwerkzaamheden.</p>
        </div>
        <Link href="/admin/fietsen/nieuw" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
          Fiets toevoegen
        </Link>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="rounded-xl border border-line bg-card p-5 transition hover:border-brand-200 hover:shadow-sm">
            <dt className="text-sm text-ink-soft">{metric.label}</dt>
            <dd className="mt-1 text-3xl font-bold tracking-tight text-ink">{metric.value}</dd>
            <p className="mt-1 text-xs text-ink-faint">{metric.hint}</p>
          </Link>
        ))}
      </dl>
      <section className="mt-8 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Voorraad beheren</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Voeg een unieke fiets toe, upload foto&apos;s, vul de basisgegevens in en publiceer pas wanneer de checklist compleet is.
        </p>
        <Link href="/admin/fietsen" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline">
          Naar fietsbeheer
        </Link>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/fietsen/nieuw" className="rounded-xl border border-brand-200 bg-brand-50 p-5 hover:bg-brand-100">
          <h3 className="font-semibold text-brand-900">Nieuwe fietsadvertentie</h3>
          <p className="mt-1 text-sm text-brand-800">Gegevens, meerdere foto&apos;s en optioneel direct publiceren.</p>
        </Link>
        <Link href="/admin/instellingen" className="rounded-xl border border-line bg-card p-5 hover:bg-surface">
          <h3 className="font-semibold text-ink">Bedrijfsinstellingen</h3>
          <p className="mt-1 text-sm text-ink-soft">Contactgegevens, bedrijfsinformatie en juridische controlestatus.</p>
        </Link>
      </section>
    </div>
  );
}

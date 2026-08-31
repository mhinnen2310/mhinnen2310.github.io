import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import type { BikeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STOCK_STATUSES: BikeStatus[] = [
  "INTAKE",
  "WORKSHOP",
  "READY",
  "AVAILABLE",
  "RESERVED",
  "SALE_PENDING",
];
const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  WORKSHOP: "Werkplaats",
  READY: "Ready",
  AVAILABLE: "Beschikbaar",
  RESERVED: "Gereserveerd",
  SALE_PENDING: "Verkoop in behandeling",
};

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const start = monthStart(now);
  const ageing30 = new Date(now.getTime() - 30 * 86_400_000);
  const ageing60 = new Date(now.getTime() - 60 * 86_400_000);
  const ageing90 = new Date(now.getTime() - 90 * 86_400_000);
  const stockWhere = { status: { in: STOCK_STATUSES } };
  const [
    stockGroups,
    soldThisMonth,
    pendingOrders,
    products,
    appointments,
    serviceRequests,
    messages,
    expiredReservations,
    manualReviews,
    incompleteWorkshop,
    lowQr,
  ] = await Promise.all([
    prisma.bike.groupBy({
      by: ["status"],
      where: stockWhere,
      _count: { _all: true },
      _sum: { acquisitionCostCents: true, priceCents: true },
    }),
    prisma.bike.findMany({
      where: { status: "SOLD", soldAt: { gte: start } },
      select: {
        soldAt: true,
        createdAt: true,
        realisedSalePriceCents: true,
        priceCents: true,
        acquisitionCostCents: true,
        partsCostCents: true,
        repairCostCents: true,
        otherCostCents: true,
        brand: true,
        bikeType: true,
      },
    }),
    prisma.order.count({ where: { paymentStatus: "PENDING" } }),
    prisma.product.findMany({
      where: { active: true },
      select: { stockQuantity: true, lowStockThreshold: true },
    }),
    prisma.appointment.count({ where: { status: "NEW" } }),
    prisma.serviceRequest.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.reservation.count({
      where: { status: "ACTIVE", expiresAt: { lt: now } },
    }),
    prisma.payment.count({ where: { status: "paid_requires_manual_review" } }),
    prisma.bike.count({
      where: {
        status: "WORKSHOP",
        serviceTasks: { some: { completed: false } },
      },
    }),
    prisma.qrTag.count({ where: { status: "UNUSED" } }),
  ]);

  const byStatus = new Map(stockGroups.map((row) => [row.status, row]));
  const rowCount = (row: (typeof stockGroups)[number] | undefined) =>
    row && typeof row._count === "object" && row._count
      ? (row._count._all ?? 0)
      : 0;
  const countFor = (status: BikeStatus) => rowCount(byStatus.get(status));
  const stockCount = stockGroups.reduce((sum, row) => sum + rowCount(row), 0);
  const stockValue = stockGroups.reduce(
    (sum, row) =>
      sum +
      (row && typeof row._sum === "object" && row._sum
        ? (row._sum.acquisitionCostCents ?? 0)
        : 0),
    0,
  );
  const activeLowStock = products.filter(
    (product) => product.stockQuantity <= product.lowStockThreshold,
  ).length;
  const revenue = soldThisMonth.reduce(
    (sum, bike) => sum + (bike.realisedSalePriceCents ?? bike.priceCents),
    0,
  );
  const margin = soldThisMonth.reduce(
    (sum, bike) =>
      sum +
      (bike.realisedSalePriceCents ?? bike.priceCents) -
      (bike.acquisitionCostCents ?? 0) -
      bike.partsCostCents -
      bike.repairCostCents -
      bike.otherCostCents,
    0,
  );
  const averageMargin = soldThisMonth.length
    ? Math.round(margin / soldThisMonth.length)
    : 0;
  const averageSaleDays = soldThisMonth.length
    ? Math.round(
        soldThisMonth.reduce(
          (sum, bike) =>
            sum + (bike.soldAt ? daysBetween(bike.createdAt, bike.soldAt) : 0),
          0,
        ) / soldThisMonth.length,
      )
    : 0;
  const unsoldWhere = { status: { in: STOCK_STATUSES } };
  const [older30, older60, older90] = await Promise.all([
    prisma.bike.count({
      where: { ...unsoldWhere, createdAt: { lt: ageing30 } },
    }),
    prisma.bike.count({
      where: { ...unsoldWhere, createdAt: { lt: ageing60 } },
    }),
    prisma.bike.count({
      where: { ...unsoldWhere, createdAt: { lt: ageing90 } },
    }),
  ]);

  const group = (key: "brand" | "bikeType") => {
    const map = new Map<
      string,
      { count: number; revenue: number; margin: number }
    >();
    for (const bike of soldThisMonth) {
      const label = bike[key] ?? "Onbekend";
      const sale = bike.realisedSalePriceCents ?? bike.priceCents;
      const bikeMargin =
        sale -
        (bike.acquisitionCostCents ?? 0) -
        bike.partsCostCents -
        bike.repairCostCents -
        bike.otherCostCents;
      const current = map.get(label) ?? { count: 0, revenue: 0, margin: 0 };
      map.set(label, {
        count: current.count + 1,
        revenue: current.revenue + sale,
        margin: current.margin + bikeMargin,
      });
    }
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);
  };
  const priceBands = [
    ["< €1.000", 0, 100_000],
    ["€1.000–€2.000", 100_000, 200_000],
    ["> €2.000", 200_000, Number.MAX_SAFE_INTEGER],
  ].map(([label, min, max]) => {
    const rows = soldThisMonth.filter((bike) => {
      const price = bike.realisedSalePriceCents ?? bike.priceCents;
      return price >= Number(min) && price < Number(max);
    });
    return {
      label: String(label),
      count: rows.length,
      revenue: rows.reduce(
        (sum, bike) => sum + (bike.realisedSalePriceCents ?? bike.priceCents),
        0,
      ),
    };
  });
  const alerts = [
    {
      label: "Nieuwe verkopen",
      value: soldThisMonth.length,
      href: "/admin/bestellingen",
    },
    {
      label: "Betalingen controleren",
      value: manualReviews,
      href: "/admin/betalingen-controleren",
    },
    {
      label: "Verlopen reserveringen",
      value: expiredReservations,
      href: "/admin/reserveringen",
    },
    {
      label: "Lage accessoirevoorraad",
      value: activeLowStock,
      href: "/admin/accessoires",
    },
    {
      label: "Nieuwe afspraken",
      value: appointments,
      href: "/admin/afspraken",
    },
    {
      label: "Nieuwe serviceverzoeken",
      value: serviceRequests,
      href: "/admin/service",
    },
    { label: "Nieuwe berichten", value: messages, href: "/admin/berichten" },
    {
      label: "Openstaande orders",
      value: pendingOrders,
      href: "/admin/bestellingen",
    },
    {
      label: "Werkplaats incompleet",
      value: incompleteWorkshop,
      href: "/admin/fietsen",
    },
    ...(lowQr < 25
      ? [{ label: "QR-voorraad laag", value: lowQr, href: "/admin/qr-labels" }]
      : []),
  ].filter((item) => item.value > 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Bedrijfsdashboard
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Actuele voorraad, verkoopresultaten en werk dat aandacht vraagt.
          </p>
        </div>
        <Link
          href="/admin/fietsen/nieuw"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Fiets toevoegen
        </Link>
      </div>
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">Actie vereist</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Live uit de operationele administratie.
            </p>
          </div>
          <Link
            href="/admin/actie-vereist"
            className="text-sm font-semibold text-brand-700 underline"
          >
            Volledig overzicht
          </Link>
        </div>
        {alerts.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {alerts.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-line bg-surface px-3 py-3 hover:border-brand-200"
              >
                <p className="text-2xl font-bold text-ink">{item.value}</p>
                <p className="text-xs text-ink-soft">{item.label}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Geen openstaande acties.
          </p>
        )}
      </section>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Fietsen in voorraad"
          value={stockCount}
          hint={`${countFor("AVAILABLE")} beschikbaar`}
          href="/admin/fietsen"
        />
        <Metric
          label="Voorraadwaarde"
          value={formatPrice(stockValue)}
          hint="Inkoopwaarde huidige voorraad"
          href="/admin/fietsen"
        />
        <Metric
          label="Verkocht deze maand"
          value={soldThisMonth.length}
          hint={formatPrice(revenue)}
          href="/admin/bestellingen"
        />
        <Metric
          label="Gerealiseerde marge"
          value={formatPrice(margin)}
          hint={`${formatPrice(averageMargin)} gemiddeld per fiets`}
          href="/admin/bestellingen"
        />
      </dl>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold text-ink">Voorraad per status</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STOCK_STATUSES.map((status) => (
              <div key={status} className="rounded-lg bg-surface p-3">
                <p className="text-xl font-bold text-ink">{countFor(status)}</p>
                <p className="text-xs text-ink-soft">{STATUS_LABELS[status]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold text-ink">Verkooptempo</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              [">30 dagen", older30],
              [">60 dagen", older60],
              [">90 dagen", older90],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-surface p-3">
                <p className="text-xl font-bold text-ink">{value}</p>
                <p className="text-xs text-ink-soft">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Gemiddelde verkooptijd deze maand:{" "}
            <strong className="text-ink">{averageSaleDays} dagen</strong>.
          </p>
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Analyse verkopen deze maand</h3>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <Analysis title="Per merk" rows={group("brand")} />
          <Analysis title="Per type" rows={group("bikeType")} />
          <div>
            <h4 className="text-sm font-semibold text-ink">Per prijsklasse</h4>
            <ul className="mt-2 space-y-2">
              {priceBands.map((row) => (
                <li
                  key={row.label}
                  className="flex justify-between rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <span>
                    {row.label}{" "}
                    <span className="text-ink-faint">({row.count})</span>
                  </span>
                  <strong>{formatPrice(row.revenue)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Snelkoppelingen</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/fietsen/nieuw"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Nieuwe fiets
          </Link>
          <Link
            href="/admin/instellingen"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Websitebeheer
          </Link>
          <Link
            href="/admin/klanten"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Klantdossiers
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-card p-5 transition hover:border-brand-200 hover:shadow-sm"
    >
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight text-ink">
        {value}
      </dd>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </Link>
  );
}
function Analysis({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, { count: number; revenue: number; margin: number }]>;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-2 space-y-2">
        {rows.length ? (
          rows.map(([label, row]) => (
            <li key={label} className="rounded-lg bg-surface px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span>
                  {label} <span className="text-ink-faint">({row.count})</span>
                </span>
                <strong>{formatPrice(row.revenue)}</strong>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Marge {formatPrice(row.margin)}
              </p>
            </li>
          ))
        ) : (
          <li className="text-sm text-ink-faint">
            Nog geen verkopen deze maand.
          </li>
        )}
      </ul>
    </div>
  );
}

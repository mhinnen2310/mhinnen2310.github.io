import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffUser } from "@/lib/admin-auth";
import { findPublicBikeBySlug } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { publicQrState } from "@/lib/qr-tags";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QrTagPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) notFound();
  const [tag, staff] = await Promise.all([
    prisma.qrTag.findUnique({
      where: { secureToken: token },
      select: {
        id: true,
        displayCode: true,
        status: true,
        bike: {
          select: {
            id: true,
            slug: true,
            inventoryCode: true,
            title: true,
            status: true,
          },
        },
      },
    }),
    getStaffUser(),
  ]);
  if (!tag) notFound();
  const publicBike =
    tag.status === "BOUND" && tag.bike
      ? await findPublicBikeBySlug(tag.bike.slug)
      : null;
  const afterSalesBike =
    !publicBike && tag.status === "BOUND" && tag.bike
      ? await prisma.bike.findUnique({
          where: { id: tag.bike.id },
          select: {
            id: true,
            slug: true,
            inventoryCode: true,
            title: true,
            brand: true,
            model: true,
            soldAt: true,
            warrantyStart: true,
            warrantyEnd: true,
            batteryManufacturer: true,
            batteryModel: true,
            batteryWh: true,
            batteryMeasuredWh: true,
            batterySohPercent: true,
            serviceTasks: {
              where: { completed: true },
              orderBy: [{ doneDate: "desc" }, { updatedAt: "desc" }],
              take: 30,
              select: {
                id: true,
                description: true,
                doneDate: true,
                partName: true,
              },
            },
            warrantyRecords: {
              orderBy: { endAt: "desc" },
              select: {
                id: true,
                scope: true,
                description: true,
                startAt: true,
                endAt: true,
              },
            },
          },
        })
      : null;
  if (staff)
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          QR asset-tag
        </p>
        <h1 className="mt-1 text-3xl font-bold text-ink">{tag.displayCode}</h1>
        <p className="mt-3 text-ink-soft">
          {tag.status === "UNUSED"
            ? "Ongebruikt"
            : tag.status === "BOUND"
              ? "Gekoppeld"
              : "Ingetrokken"}
        </p>
        {tag.bike ? (
          <div className="mt-5 rounded-xl border border-line bg-card p-5">
            <strong>{tag.bike.title}</strong>
            <p className="mt-1 text-sm text-ink-soft">
              {tag.bike.inventoryCode} · {tag.bike.status}
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href={`/admin/fietsen/${tag.bike.id}`}
                className="text-sm font-semibold text-brand-800 underline"
              >
                Open dossier
              </Link>
              <Link
                href={`/admin/fietsen/${tag.bike.id}#werkplaats`}
                className="text-sm font-semibold text-brand-800 underline"
              >
                Werkplaats
              </Link>
            </div>
          </div>
        ) : tag.status === "UNUSED" ? (
          <Link
            href={`/admin/qr-labels/${tag.id}`}
            className="mt-5 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Koppel aan fiets
          </Link>
        ) : (
          <p className="mt-5 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
            Deze QR-tag is ingetrokken en kan niet meer worden gekoppeld.
          </p>
        )}
      </main>
    );
  if (afterSalesBike) return <AfterSalesPortal bike={afterSalesBike} />;
  if (!publicBike)
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-ink">Demi Fietsen</h1>
        <p className="mt-3 text-ink-soft">{publicQrState(tag.status)}</p>
        {tag.status === "RETIRED" && (
          <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
            Deze QR-tag is ingetrokken.
          </p>
        )}
      </main>
    );
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Demi Fietsen
      </p>
      <h1 className="mt-1 text-3xl font-bold text-ink">
        {publicBike.public.title}
      </h1>
      <p className="mt-2 text-ink-soft">
        {publicBike.public.brand} {publicBike.public.model}
      </p>
      <Link
        href={`/fietsen/${publicBike.public.slug}`}
        className="mt-5 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Bekijk fiets
      </Link>
    </main>
  );
}

function AfterSalesPortal({
  bike,
}: {
  bike: {
    id: string;
    slug: string;
    inventoryCode: string;
    title: string;
    brand: string;
    model: string;
    soldAt: Date | null;
    warrantyStart: Date | null;
    warrantyEnd: Date | null;
    batteryManufacturer: string | null;
    batteryModel: string | null;
    batteryWh: number | null;
    batteryMeasuredWh: number | null;
    batterySohPercent: unknown;
    serviceTasks: Array<{
      id: string;
      description: string;
      doneDate: Date | null;
      partName: string | null;
    }>;
    warrantyRecords: Array<{
      id: string;
      scope: string;
      description: string;
      startAt: Date;
      endAt: Date;
    }>;
  };
}) {
  const soh =
    bike.batterySohPercent == null ? null : String(bike.batterySohPercent);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Demi Fietsen · Mijn fiets
      </p>
      <h1 className="mt-1 text-3xl font-bold text-ink">{bike.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {bike.brand} {bike.model} · {bike.inventoryCode}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Info
          title="Aankoopdatum"
          value={bike.soldAt ? formatDate(bike.soldAt) : "Nog niet verkocht"}
        />
        <Info
          title="Garantie"
          value={
            bike.warrantyStart && bike.warrantyEnd
              ? `${formatDate(bike.warrantyStart)} t/m ${formatDate(bike.warrantyEnd)}`
              : bike.warrantyEnd
                ? `t/m ${formatDate(bike.warrantyEnd)}`
                : "Zie je aankoopbewijs"
          }
        />
        <Info
          title="Accu"
          value={
            [bike.batteryManufacturer, bike.batteryModel]
              .filter(Boolean)
              .join(" ") || "Niet ingevuld"
          }
        />
        <Info
          title="Accucapaciteit"
          value={
            bike.batteryMeasuredWh
              ? `${bike.batteryMeasuredWh} Wh gemeten`
              : bike.batteryWh
                ? `${bike.batteryWh} Wh nominaal`
                : "Niet ingevuld"
          }
        />
        {soh && <Info title="Accustaat" value={`${soh}% (meting)`} />}
      </div>
      {bike.warrantyRecords.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold text-ink">Garantie</h2>
          <ul className="mt-3 space-y-2">
            {bike.warrantyRecords.map((record) => (
              <li
                key={record.id}
                className="rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <p className="font-medium text-ink">{record.scope}</p>
                <p className="mt-1 text-ink-soft">{record.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {formatDate(record.startAt)} t/m {formatDate(record.endAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {bike.serviceTasks.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold text-ink">Uitgevoerd onderhoud</h2>
          <ul className="mt-3 space-y-2">
            {bike.serviceTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <p className="font-medium text-ink">{task.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {task.doneDate
                    ? formatDate(task.doneDate)
                    : "Datum niet ingevuld"}
                  {task.partName ? ` · ${task.partName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/service?bikeId=${encodeURIComponent(bike.id)}`}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Onderhoud aanvragen
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"
        >
          Contact opnemen
        </Link>
        <Link
          href="/account"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"
        >
          Factuur in klantaccount
        </Link>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Voor privacy tonen we facturen en persoonsgegevens alleen na inloggen in
        het klantaccount.
      </p>
    </main>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs text-ink-faint">{title}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

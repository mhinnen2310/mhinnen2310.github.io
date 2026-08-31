import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "In afwachting",
  PAID: "Betaald",
  FAILED: "Mislukt",
  EXPIRED: "Verlopen",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
  PARTIALLY_REFUNDED: "Deels terugbetaald",
};

export default async function AdminCustomerDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          paymentStatus: true,
          fulfilmentStatus: true,
          totalCents: true,
          customerPhone: true,
          lines: {
            orderBy: { createdAt: "asc" },
            select: {
              name: true,
              identifier: true,
              lineTotalCents: true,
              bikeId: true,
              bike: {
                select: {
                  id: true,
                  title: true,
                  inventoryCode: true,
                  slug: true,
                },
              },
            },
          },
          invoices: {
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              issuedAt: true,
            },
          },
        },
      },
    },
  });
  if (!customer) notFound();
  const orderIds = customer.orders.map((order) => order.id);
  const [warranties, serviceRequests, appointments] = await Promise.all([
    orderIds.length
      ? prisma.warrantyRecord.findMany({
          where: { orderId: { in: orderIds } },
          orderBy: { endAt: "desc" },
          include: { bike: { select: { title: true, inventoryCode: true } } },
        })
      : Promise.resolve([]),
    prisma.serviceRequest.findMany({
      where: {
        OR: [
          { customerEmail: customer.email },
          {
            orderNumber: {
              in: customer.orders.map((order) => order.orderNumber),
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { bike: { select: { title: true, inventoryCode: true } } },
    }),
    prisma.appointment.findMany({
      where: { customerEmail: customer.email },
      orderBy: { preferredDate: "desc" },
      take: 30,
      include: { bike: { select: { title: true, inventoryCode: true } } },
    }),
  ]);
  const bikes = [
    ...new Map(
      customer.orders
        .flatMap((order) => order.lines.flatMap((line) => (line.bike ? [line.bike] : [])))
        .map((bike) => [bike.id, bike] as const),
    ).values(),
  ];
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/klanten"
            className="text-sm font-semibold text-brand-700 underline"
          >
            ← Alle klantdossiers
          </Link>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {customer.name ?? "Naam ontbreekt"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {customer.email} · klant sinds {formatDate(customer.createdAt)} ·{" "}
            {customer.isActive ? "actief account" : "uitgeschakeld account"}
          </p>
        </div>
        <Link
          href={`/admin/gebruikers?q=${encodeURIComponent(customer.email)}`}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface"
        >
          Account beheren
        </Link>
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold text-ink">Contactgegevens</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">E-mail</dt>
              <dd className="font-medium text-ink">{customer.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Telefoon</dt>
              <dd className="font-medium text-ink">
                {customer.orders[0]?.customerPhone ?? "—"}
              </dd>
            </div>
            {customer.addresses.map((address) => (
              <div key={address.id} className="border-t border-line pt-2">
                <dt className="text-ink-soft">{address.label}</dt>
                <dd className="mt-1 text-ink">
                  {address.line1}
                  {address.line2 && <>, {address.line2}</>}
                  <br />
                  {address.postcode} {address.city}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold text-ink">Fietsen van deze klant</h3>
          {bikes.length ? (
            <ul className="mt-3 space-y-2">
              {bikes.map((bike) => (
                <li
                  key={bike.id}
                  className="flex justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <span>
                    {bike.inventoryCode} · {bike.title}
                  </span>
                  <Link
                    href={`/admin/fietsen/${bike.id}`}
                    className="font-semibold text-brand-700 underline"
                  >
                    Dossier
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-faint">
              Geen fiets gekoppeld aan een order.
            </p>
          )}
        </div>
      </section>
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">
          Aankoopgeschiedenis & facturen
        </h3>
        <div className="mt-3 space-y-3">
          {customer.orders.map((order) => (
            <article
              key={order.id}
              className="rounded-lg border border-line p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/bestellingen/${order.id}`}
                    className="font-semibold text-brand-700 underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(order.placedAt)} ·{" "}
                    {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}{" "}
                    · {order.fulfilmentStatus}
                  </p>
                </div>
                <strong>{formatPrice(order.totalCents)}</strong>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {order.lines.map((line, index) => (
                  <li
                    key={`${order.id}-${index}`}
                    className="flex justify-between gap-3"
                  >
                    <span>
                      {line.name}
                      {line.identifier && (
                        <span className="ml-1 text-xs text-ink-faint">
                          ({line.identifier})
                        </span>
                      )}
                    </span>
                    <span>{formatPrice(line.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>
              {order.invoices.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.invoices.map((invoice) => (
                    <a
                      key={invoice.id}
                      href={`/api/invoices/${invoice.id}/download`}
                      className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                    >
                      {invoice.invoiceNumber} ({invoice.status})
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
          {customer.orders.length === 0 && (
            <p className="text-sm text-ink-faint">Geen bestellingen.</p>
          )}
        </div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <DossierList
          title="Garantie"
          empty="Geen garantieregistraties."
          items={warranties.map((item) => (
            <li
              key={item.id}
              className="rounded-lg bg-surface px-3 py-2 text-sm"
            >
              <p className="font-medium text-ink">
                {item.bike?.inventoryCode ?? "Fiets"} · {item.scope}
              </p>
              <p className="mt-1 text-ink-soft">{item.description}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatDate(item.startAt)} t/m {formatDate(item.endAt)}
              </p>
            </li>
          ))}
        />
        <DossierList
          title="Serviceverzoeken"
          empty="Geen serviceverzoeken."
          items={serviceRequests.map((item) => (
            <li
              key={item.id}
              className="rounded-lg bg-surface px-3 py-2 text-sm"
            >
              <p className="font-medium text-ink">
                {item.type} · {item.status}
              </p>
              <p className="mt-1 text-ink-soft">{item.description}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatDateTime(item.createdAt)}
                {item.bike ? ` · ${item.bike.inventoryCode}` : ""}
              </p>
            </li>
          ))}
        />
      </section>
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Afspraken</h3>
        {appointments.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {appointments.map((item) => (
              <li
                key={item.id}
                className="rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <p className="font-medium text-ink">
                  {formatDateTime(item.preferredDate)} · {item.timeBlock}
                </p>
                <p className="text-xs text-ink-soft">
                  {item.status}
                  {item.bike ? ` · ${item.bike.inventoryCode}` : ""}
                </p>
                {item.message && (
                  <p className="mt-1 text-xs text-ink-faint">{item.message}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">Geen afspraken.</p>
        )}
      </section>
    </div>
  );
}

function DossierList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: React.ReactNode[];
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2">{items}</ul>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">{empty}</p>
      )}
    </div>
  );
}

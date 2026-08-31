import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findOrdersForUser, type PublicOrder } from "@/lib/order-view";
import { formatPrice, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { AccountActions } from "@/components/account-actions";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { roleAtLeast } from "@/lib/auth";

export const metadata: Metadata = { title: "Mijn account" };

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Betaling in afwachting",
  PAID: "Betaald",
  FAILED: "Betaling mislukt",
  EXPIRED: "Betaling verlopen",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
  PARTIALLY_REFUNDED: "Deels terugbetaald",
};

const FULFILMENT_LABELS: Record<string, string> = {
  UNFULFILLED: "In behandeling",
  PREPARING: "In voorbereiding",
  READY_FOR_PICKUP: "Klaar om op te halen",
  OUT_FOR_DELIVERY: "Onderweg",
  FULFILLED: "Afgerond",
  CANCELLED: "Geannuleerd",
};

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/inloggen?callbackUrl=%2Faccount");

  const [orders, serviceRequests] = await Promise.all([
    findOrdersForUser(user.id),
    prisma.serviceRequest.findMany({
      where: { customerEmail: user.email },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { type: true, status: true, createdAt: true, orderNumber: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Mijn account</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span>{user.name ? `${user.name} · ` : ""}{user.email}</span>
            {user.emailVerified ? (
              <Badge tone="green">E-mail geverifieerd</Badge>
            ) : (
              <Badge tone="amber">E-mail nog niet geverifieerd</Badge>
            )}
          </p>
        </div>
        {roleAtLeast(user.role, "STAFF") && (
          <Link href="/admin" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            Beheerpaneel openen
          </Link>
        )}
      </div>

      {/* Orders */}
      <section className="mt-8" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="text-lg font-semibold text-ink">
          Je bestellingen
        </h2>
        {orders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nog geen bestellingen"
              hint="Zodra je iets hebt besteld, vind je het hier — inclusief factuur en garantie."
              action={
                <Link
                  href="/fietsen"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Bekijk beschikbare fietsen
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          Bestelling niet gevonden?{" "}
          <Link href="/order-status" className="underline">
            Zoek op bestelnummer + e-mail
          </Link>
          .
        </p>
      </section>

      {/* Service requests */}
      {serviceRequests.length > 0 && (
        <section className="mt-10" aria-labelledby="service-heading">
          <h2 id="service-heading" className="text-lg font-semibold text-ink">
            Service- en retourverzoeken
          </h2>
          <ul className="mt-4 space-y-2">
            {serviceRequests.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm">
                <span className="font-medium text-ink">
                  {SERVICE_TYPE_LABELS[r.type] ?? r.type}
                  {r.orderNumber && <span className="ml-2 text-xs text-ink-faint">Bestelling {r.orderNumber}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  {formatDate(r.createdAt)}
                  <Badge tone={r.status === "NEW" ? "amber" : r.status === "RESOLVED" || r.status === "CLOSED" ? "green" : "gray"}>
                    {SERVICE_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Settings */}
      <section className="mt-10 border-t border-line pt-8" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-lg font-semibold text-ink">
          Accountbeheer
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/account/wachtwoord"
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          >
            Wachtwoord wijzigen
          </Link>
          <Link
            href="/wachtwoord-vergeten"
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          >
            Wachtwoord vergeten
          </Link>
        </div>
        <div className="mt-4">
          <AccountActions />
        </div>
      </section>
    </div>
  );
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  RETURN: "Retour / omruiling",
  WARRANTY: "Garantie-claim",
  SERVICE: "Service",
  DAMAGE: "Beschadiging",
  OTHER: "Overig",
};

const SERVICE_STATUS_LABELS: Record<string, string> = {
  NEW: "Ontvangen",
  IN_PROGRESS: "In behandeling",
  AWAITING_CUSTOMER: "Wacht op klant",
  RESOLVED: "Opgelost",
  CLOSED: "Afgerond",
  CANCELLED: "Geannuleerd",
};

function OrderCard({ order }: { order: PublicOrder }) {
  const paidTone = order.paymentStatus === "PAID" ? "green" : order.paymentStatus === "PENDING" ? "amber" : "red";

  return (
    <li className="rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Bestelling {order.orderNumber}</p>
          <p className="text-xs text-ink-soft">
            {formatDate(order.placedAt)} · {order.lines.length} {order.lines.length === 1 ? "artikel" : "artikelen"} ·{" "}
            {formatPrice(order.totalCents)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={paidTone}>{PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}</Badge>
          <Badge tone={order.fulfilmentStatus === "FULFILLED" ? "green" : "gray"}>
            {FULFILMENT_LABELS[order.fulfilmentStatus] ?? order.fulfilmentStatus}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {order.invoiceId && (
          <a
            href={`/api/invoices/${order.invoiceId}/download`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
          >
            Factuur {order.invoiceNumber} (PDF)
          </a>
        )}
        <Link
          href={`/service?order=${encodeURIComponent(order.orderNumber)}`}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
        >
          Retour / service
        </Link>
      </div>

      <details className="group border-t border-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-brand-700 underline group-open:text-ink">
          Bekijk items & garantie
        </summary>
        <ul className="border-t border-line px-4 py-3 text-sm">
          {order.lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-1">
              <span className="text-ink-soft">
                {l.quantity > 1 && <span className="mr-1 text-xs text-ink-faint">×{l.quantity}</span>}
                {l.name}
                {l.identifier && <span className="ml-1 text-xs text-ink-faint">({l.identifier})</span>}
              </span>
              <span className="font-medium text-ink">{formatPrice(l.lineTotalCents)}</span>
            </li>
          ))}
          {order.warranties.length > 0 && (
            <li className="mt-3 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
              <p className="font-semibold">Garantie bij deze verkoop</p>
              {order.warranties.map((w, i) => (
                <p key={i} className="mt-1">
                  {w.description} <span className="text-brand-600">(einde: {formatDate(w.endAt)})</span>
                </p>
              ))}
            </li>
          )}
        </ul>
      </details>
    </li>
  );
}

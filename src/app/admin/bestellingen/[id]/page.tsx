import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOrderRefundForm } from "@/components/admin-order-refund-form";
import { AdminOrderCustomerLink } from "@/components/admin-order-customer-link";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, customers] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        lines: true,
        payments: { orderBy: { createdAt: "desc" } },
        invoices: { orderBy: { issuedAt: "desc" } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", isActive: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 500,
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!order) notFound();
  const refundable =
    order.paymentStatus === "PAID" ||
    order.paymentStatus === "PARTIALLY_REFUNDED";
  const remaining = order.totalCents - order.refundedCents;
  return (
    <div>
      <Link
        href="/admin/bestellingen"
        className="text-sm text-brand-800 underline"
      >
        ← Bestellingen
      </Link>
      <h2 className="mt-3 text-2xl font-bold text-ink">{order.orderNumber}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {order.customerName} · {order.customerEmail} ·{" "}
        {formatDateTime(order.placedAt)}
      </p>
      <section className="mt-5 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Klantaccount</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {order.user
            ? `Gekoppeld aan ${order.user.name ?? order.user.email}`
            : "Deze verkoop is nog niet aan een klantaccount gekoppeld."}
        </p>
        <AdminOrderCustomerLink
          orderId={order.id}
          currentUserId={order.user?.id ?? null}
          customers={customers}
        />
      </section>
      <section className="mt-5 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Verkoop</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {formatPrice(order.totalCents)} · {order.paymentStatus} · uitvoering{" "}
          {order.fulfilmentStatus}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.name}
                {line.identifier ? ` · ${line.identifier}` : ""} ×{" "}
                {line.quantity}
              </span>
              <strong>{formatPrice(line.lineTotalCents)}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-5 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Betalingen en documenten</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {order.payments.map((payment) => (
            <li key={payment.id}>
              {payment.method} · {payment.status} ·{" "}
              {formatPrice(payment.amountCents)}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-sm">
          {order.invoices.map((invoice) => (
            <li key={invoice.id}>
              <a
                className="text-brand-800 underline"
                href={`/api/invoices/${invoice.id}/download`}
              >
                {invoice.status === "CREDIT_NOTE" ? "Creditnota" : "Factuur"}{" "}
                {invoice.invoiceNumber}
              </a>
            </li>
          ))}
        </ul>
      </section>
      {refundable && remaining > 0 && (
        <AdminOrderRefundForm
          orderId={order.id}
          remainingCents={remaining}
          currency={order.currency}
        />
      )}
    </div>
  );
}

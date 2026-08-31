import Link from "next/link";
import { AdminPaymentReviewButton } from "@/components/admin-payment-review-button";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PaymentReviewPage() {
  const payments = await prisma.payment.findMany({ where: { status: "paid_requires_manual_review" }, orderBy: { updatedAt: "asc" }, include: { order: { select: { id: true, orderNumber: true, totalCents: true, paymentStatus: true, lines: { select: { bike: { select: { inventoryCode: true, status: true } } } } } } } });
  return <div><h2 className="text-2xl font-bold text-ink">Betalingen controleren</h2><p className="mt-1 text-sm text-ink-soft">Alleen provider-geverifieerde betalingen die door een voorraad- of reserveringsconflict niet automatisch konden afronden.</p><div className="mt-6 space-y-3">{payments.map((payment) => <article key={payment.id} className="rounded-xl border border-state-warning/40 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/admin/bestellingen/${payment.order.id}`} className="font-semibold text-brand-800 underline">{payment.order.orderNumber}</Link><p className="mt-1 text-sm text-ink-soft">{formatPrice(payment.order.totalCents)} · payment {payment.status} · ontvangen {payment.capturedAt ? formatDateTime(payment.capturedAt) : "onbekend"}</p><p className="mt-2 text-xs text-ink-faint">Fietsen: {payment.order.lines.map((line) => line.bike ? `${line.bike.inventoryCode} (${line.bike.status})` : "accessoire").join(", ")}</p></div><AdminPaymentReviewButton paymentId={payment.id} /></div></article>)}{!payments.length && <p className="rounded-xl border border-line bg-card p-5 text-sm text-ink-soft">Geen betalingen die handmatige controle vereisen.</p>}</div></div>;
}

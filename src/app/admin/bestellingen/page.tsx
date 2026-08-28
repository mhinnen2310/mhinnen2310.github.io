import Link from "next/link";
import { AdminStatusControl } from "@/components/admin-status-control";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/utils";

const FULFILMENT_OPTIONS = [
  { value: "UNFULFILLED", label: "Nog verwerken" }, { value: "PREPARING", label: "In voorbereiding" },
  { value: "READY_FOR_PICKUP", label: "Klaar voor ophalen" }, { value: "OUT_FOR_DELIVERY", label: "Onderweg" },
  { value: "FULFILLED", label: "Afgerond" }, { value: "CANCELLED", label: "Geannuleerd" },
];

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { placedAt: "desc" }, take: 100,
    select: { id: true, orderNumber: true, customerName: true, customerEmail: true, totalCents: true, paymentStatus: true, fulfilmentStatus: true, deliveryMethod: true, placedAt: true, _count: { select: { lines: true } } },
  });
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">Bestellingen</h2>
      <p className="mt-1 text-sm text-ink-soft">De 100 nieuwste bestellingen. Betalingen volgen de provider; hier beheer je de uitvoering.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint"><tr>
            <th className="px-4 py-3">Bestelling</th><th className="px-4 py-3">Klant</th><th className="px-4 py-3">Bedrag</th><th className="px-4 py-3">Betaling</th><th className="px-4 py-3">Uitvoering</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((order) => <tr key={order.id}>
              <td className="px-4 py-3"><p className="font-semibold text-ink">{order.orderNumber}</p><p className="text-xs text-ink-faint">{formatDateTime(order.placedAt)} · {order._count.lines} regels</p></td>
              <td className="px-4 py-3"><p>{order.customerName}</p><a href={`mailto:${order.customerEmail}`} className="text-xs text-brand-700 underline">{order.customerEmail}</a></td>
              <td className="px-4 py-3">{formatPrice(order.totalCents)}<p className="text-xs text-ink-faint">{order.deliveryMethod ?? "geen levering"}</p></td>
              <td className="px-4 py-3"><span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold">{order.paymentStatus}</span></td>
              <td className="px-4 py-3"><AdminStatusControl entity="orderFulfilment" id={order.id} value={order.fulfilmentStatus} options={FULFILMENT_OPTIONS} /></td>
            </tr>)}
            {orders.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Nog geen bestellingen.</td></tr>}
          </tbody>
        </table>
      </div>
      <Link href="/order-status" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline">Open klantweergave voor orderzoeken</Link>
    </div>
  );
}

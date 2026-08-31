import Link from "next/link";
import { AdminReservationControls } from "@/components/admin-reservation-controls";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  const reservations = await prisma.reservation.findMany({
    where: { status: "ACTIVE" }, orderBy: { expiresAt: "asc" }, take: 150,
    include: { bike: { select: { id: true, inventoryCode: true, title: true, status: true } }, order: { select: { id: true, orderNumber: true, paymentStatus: true } } },
  });
  const now = new Date();
  return <div><h2 className="text-2xl font-bold text-ink">Reserveringen</h2><p className="mt-1 text-sm text-ink-soft">Handmatige en afspraakreserveringen kunnen hier veilig worden vrijgegeven. Checkout-reserveringen blijven aan de betalingslifecycle gekoppeld.</p><div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card"><table className="min-w-full text-sm"><thead className="bg-surface text-xs text-ink-faint"><tr><th className="px-4 py-3 text-left">Fiets</th><th className="px-4 py-3 text-left">Klant</th><th className="px-4 py-3 text-left">Bron</th><th className="px-4 py-3 text-left">Verloopt</th><th className="px-4 py-3 text-left">Actie</th></tr></thead><tbody>{reservations.map((item) => { const expired = item.expiresAt < now; const releasable = !item.orderId && item.source !== "CHECKOUT"; return <tr key={item.id} className="border-t border-line"><td className="px-4 py-3"><Link href={`/admin/fietsen/${item.bike.id}`} className="font-semibold text-brand-800 underline">{item.bike.inventoryCode}</Link><p className="text-xs text-ink-soft">{item.bike.title} · {item.bike.status}</p></td><td className="px-4 py-3">{item.customerName ?? "—"}<p className="text-xs text-ink-soft">{item.customerEmail ?? item.customerPhone ?? ""}</p></td><td className="px-4 py-3">{item.source}{item.order && <p className="text-xs text-ink-soft">{item.order.orderNumber} · {item.order.paymentStatus}</p>}</td><td className={`px-4 py-3 ${expired ? "font-semibold text-state-error" : ""}`}>{formatDateTime(item.expiresAt)}{expired && <p className="text-xs">Verlopen</p>}</td><td className="px-4 py-3"><AdminReservationControls reservationId={item.id} releasable={releasable} /></td></tr>; })}{!reservations.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Geen actieve reserveringen.</td></tr>}</tbody></table></div></div>;
}

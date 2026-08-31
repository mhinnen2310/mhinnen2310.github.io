import { AdminStatusControl } from "@/components/admin-status-control";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

const OPTIONS = [
  { value: "NEW", label: "Nieuw" }, { value: "IN_PROGRESS", label: "In behandeling" }, { value: "AWAITING_CUSTOMER", label: "Wacht op klant" },
  { value: "RESOLVED", label: "Opgelost" }, { value: "CLOSED", label: "Gesloten" }, { value: "CANCELLED", label: "Geannuleerd" },
];

export default async function AdminServicePage() {
  const requests = await prisma.serviceRequest.findMany({ orderBy: { createdAt: "desc" }, take: 150, include: { bike: { select: { title: true, inventoryCode: true } }, product: { select: { title: true, sku: true } } } });
  return (
    <div><h2 className="text-2xl font-bold tracking-tight text-ink">Service, retour & garantie</h2><p className="mt-1 text-sm text-ink-soft">Alle klantverzoeken met gekoppelde bestelling, fiets of accessoire.</p>
      <div className="mt-6 grid gap-4">
        {requests.map((item) => <article key={item.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{item.type} · {formatDateTime(item.createdAt)}</p><h3 className="mt-1 font-semibold text-ink">{item.customerName}</h3><p className="text-xs text-ink-faint">{item.orderNumber ?? item.bike?.inventoryCode ?? item.product?.sku ?? "Niet gekoppeld"}</p></div><AdminStatusControl entity="serviceRequest" id={item.id} value={item.status} options={OPTIONS} /></div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm"><a href={`mailto:${item.customerEmail}`} className="text-brand-700 underline">{item.customerEmail}</a>{item.customerPhone && <a href={`tel:${item.customerPhone}`} className="text-brand-700 underline">{item.customerPhone}</a>}</div>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-ink-soft">{item.description}</p>
          {item.photoKeys.length > 0 && <p className="mt-2 text-xs text-ink-faint">{item.photoKeys.length} bijgevoegde foto&apos;s</p>}
        </article>)}
        {requests.length === 0 && <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">Geen serviceverzoeken.</p>}
      </div>
    </div>
  );
}

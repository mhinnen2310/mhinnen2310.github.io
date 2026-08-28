import { AdminStatusControl } from "@/components/admin-status-control";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

const OPTIONS = [
  { value: "NEW", label: "Nieuw" }, { value: "CONTACTED", label: "Contact gehad" }, { value: "CONFIRMED", label: "Bevestigd" },
  { value: "COMPLETED", label: "Afgerond" }, { value: "CANCELLED", label: "Geannuleerd" }, { value: "NO_SHOW", label: "Niet verschenen" },
];

export default async function AdminAppointmentsPage() {
  const appointments = await prisma.appointment.findMany({ orderBy: [{ preferredDate: "asc" }, { createdAt: "desc" }], take: 150, include: { bike: { select: { title: true, inventoryCode: true } } } });
  return (
    <div><h2 className="text-2xl font-bold tracking-tight text-ink">Afspraken & proefritten</h2><p className="mt-1 text-sm text-ink-soft">Neem contact op, bevestig de afspraak en werk de status direct bij.</p>
      <div className="mt-6 grid gap-4">
        {appointments.map((item) => <article key={item.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-ink">{item.customerName}</h3><p className="text-sm text-ink-soft">{formatDateTime(item.preferredDate)} · {item.timeBlock}</p>{item.bike && <p className="mt-1 text-xs text-ink-faint">{item.bike.inventoryCode} · {item.bike.title}</p>}</div><AdminStatusControl entity="appointment" id={item.id} value={item.status} options={OPTIONS} /></div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm"><a href={`mailto:${item.customerEmail}`} className="text-brand-700 underline">{item.customerEmail}</a>{item.customerPhone && <a href={`tel:${item.customerPhone}`} className="text-brand-700 underline">{item.customerPhone}</a>}</div>
          {item.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-ink-soft">{item.message}</p>}
        </article>)}
        {appointments.length === 0 && <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">Geen afspraken.</p>}
      </div>
    </div>
  );
}

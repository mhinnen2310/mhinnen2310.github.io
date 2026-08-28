import { AdminStatusControl } from "@/components/admin-status-control";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

const OPTIONS = [{ value: "NEW", label: "Nieuw" }, { value: "CONTACTED", label: "Contact gehad" }, { value: "RESOLVED", label: "Afgerond" }];

export default async function AdminMessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 150 });
  return (
    <div><h2 className="text-2xl font-bold tracking-tight text-ink">Contactberichten</h2><p className="mt-1 text-sm text-ink-soft">De nieuwste vragen uit het contactformulier.</p>
      <div className="mt-6 grid gap-4">
        {messages.map((item) => <article key={item.id} className="rounded-xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-ink-faint">{formatDateTime(item.createdAt)}</p><h3 className="font-semibold text-ink">{item.subject ?? "Contactbericht"} · {item.name}</h3></div><AdminStatusControl entity="contactMessage" id={item.id} value={item.status} options={OPTIONS} /></div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm"><a href={`mailto:${item.email}`} className="text-brand-700 underline">{item.email}</a>{item.phone && <a href={`tel:${item.phone}`} className="text-brand-700 underline">{item.phone}</a>}</div>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-ink-soft">{item.message}</p>
        </article>)}
        {messages.length === 0 && <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">Geen contactberichten.</p>}
      </div>
    </div>
  );
}

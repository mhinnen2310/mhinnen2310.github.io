import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AdminAccountingPage() {
  const actor = await getStaffUser();
  if (!actor) redirect("/inloggen?callbackUrl=%2Fadmin%2Fadministratie");
  if (!roleAtLeast(actor.role, "OWNER")) redirect("/admin");

  const now = new Date();
  const firstOrder = await prisma.order.findFirst({ orderBy: { placedAt: "asc" }, select: { placedAt: true } });
  const from = firstOrder?.placedAt ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">Administratie exporteren</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Download een owner-only PDF met orders, betalingen, facturen, margeregeling, voorraadmutaties en audit trail voor je boekhouder.
      </p>
      <section className="mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
        <h3 className="font-semibold text-ink">Periode kiezen</h3>
        <p className="mt-1 text-sm text-ink-soft">
          De export leest uitsluitend server-side snapshots. Een ontbrekende historische inkoopbasis wordt als REVIEW gemarkeerd en niet ingevuld.
        </p>
        <form method="get" action="/api/admin/accounting/export" className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm text-ink-soft">
            Vanaf
            <input name="from" type="date" defaultValue={isoDate(from)} required className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
          </label>
          <label className="text-sm text-ink-soft">
            Tot en met
            <input name="to" type="date" defaultValue={isoDate(to)} required className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
          </label>
          <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            PDF downloaden
          </button>
        </form>
      </section>
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h3 className="font-semibold">Let op bij de margeregeling</h3>
        <p className="mt-1">
          De PDF is een overdracht voor de boekhouding en geen zelfstandig aangifteprogramma. Laat de toegepaste margeregeling, historische REVIEW-regels en eventuele creditnota&apos;s door de boekhouder controleren.
        </p>
      </section>
    </div>
  );
}

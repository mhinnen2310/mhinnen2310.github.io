import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ActionRequiredPage() {
  const now = new Date();
  const sixtyDays = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
  const [expiredReservations, manualReviews, oldStock, incompleteWorkshop, publishedSold] = await Promise.all([
    prisma.reservation.count({ where: { status: "ACTIVE", expiresAt: { lt: now } } }),
    prisma.payment.count({ where: { status: "paid_requires_manual_review" } }),
    prisma.bike.count({ where: { status: { in: ["AVAILABLE", "READY", "WORKSHOP"] }, createdAt: { lt: sixtyDays } } }),
    prisma.bike.count({ where: { status: "WORKSHOP", serviceTasks: { some: { completed: false } } } }),
    prisma.bike.count({ where: { status: { in: ["SOLD", "ARCHIVED"] }, publishedAt: { not: null } } }),
  ]);
  const rows = [
    { count: publishedSold, label: "advertenties/publicaties controleren", hint: "Verkochte of gearchiveerde fietsen met een bestaande publicatie.", href: "/admin/fietsen" },
    { count: expiredReservations, label: "reserveringen verlopen", hint: "Geef handmatige of afspraakreserveringen vrij; checkout blijft bij de betaalflow.", href: "/admin/reserveringen" },
    { count: oldStock, label: "fietsen langer dan 60 dagen op voorraad", hint: "Controleer prijs, foto’s, advertentie en doorlooptijd.", href: "/admin/fietsen" },
    { count: manualReviews, label: "betalingen handmatig controleren", hint: "Betaald signaal dat niet automatisch veilig kon worden afgerond.", href: "/admin/betalingen-controleren" },
    { count: incompleteWorkshop, label: "werkplaatsfietsen incompleet", hint: "Er staan nog openstaande werkplaatsregels.", href: "/admin/fietsen" },
  ];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <div><h2 className="text-2xl font-bold text-ink">Actie vereist</h2><p className="mt-1 text-sm text-ink-soft">Eén operationele inbox voor werk dat niet in een losse module mag blijven liggen.</p><p className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900"><strong>{total}</strong> openstaande acties.</p><div className="mt-5 grid gap-3">{rows.map((row) => <Link key={row.label} href={row.href} className={`rounded-xl border p-5 transition hover:shadow-sm ${row.count ? "border-state-warning/40 bg-card" : "border-line bg-surface"}`}><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-ink">{row.count} {row.label}</h3><p className="mt-1 text-sm text-ink-soft">{row.hint}</p></div><span className="text-brand-800">Bekijken →</span></div></Link>)}</div></div>;
}

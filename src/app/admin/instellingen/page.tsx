import { AdminSettingsForm } from "@/components/admin-settings-form";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export default async function AdminSettingsPage() {
  const [settings, legalPages] = await Promise.all([
    getSettings(),
    prisma.legalPage.findMany({ orderBy: { slug: "asc" }, select: { slug: true, title: true, requiresLegalReview: true, updatedAt: true } }),
  ]);
  return (
    <div><h2 className="text-2xl font-bold tracking-tight text-ink">Bedrijfsinstellingen</h2><p className="mt-1 text-sm text-ink-soft">Contactgegevens en bedrijfsinformatie die op de website en documenten worden gebruikt.</p>
      <div className="mt-6 rounded-xl border border-line bg-card p-5 sm:p-6"><AdminSettingsForm settings={settings} /></div>
      <section className="mt-6 rounded-xl border border-line bg-card p-5"><h3 className="font-semibold text-ink">Juridische pagina&apos;s</h3><p className="mt-1 text-sm text-ink-soft">Conceptteksten moeten vóór livegang inhoudelijk worden goedgekeurd.</p>
        <ul className="mt-4 divide-y divide-line">{legalPages.map((page) => <li key={page.slug} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{page.title}</span><span className={page.requiresLegalReview ? "font-semibold text-amber-700" : "text-brand-700"}>{page.requiresLegalReview ? "Controle nodig" : "Goedgekeurd"}</span></li>)}</ul>
      </section>
    </div>
  );
}

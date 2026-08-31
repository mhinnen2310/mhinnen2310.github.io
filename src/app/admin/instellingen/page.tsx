import { AdminSettingsForm } from "@/components/admin-settings-form";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { AdminSettingsRevisions } from "@/components/admin-settings-revisions";

export default async function AdminSettingsPage() {
  const [settings, legalPages, revisions] = await Promise.all([
    getSettings(),
    prisma.legalPage.findMany({
      orderBy: { slug: "asc" },
      select: {
        slug: true,
        title: true,
        requiresLegalReview: true,
        updatedAt: true,
      },
    }),
    prisma.siteSettingsRevision.findMany({
      where: { settingsId: 1 },
      orderBy: { version: "desc" },
      take: 30,
      select: {
        id: true,
        version: true,
        createdAt: true,
        changedBy: { select: { name: true, email: true } },
      },
    }),
  ]);
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        Bedrijfsinstellingen
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Contactgegevens en bedrijfsinformatie die op de website en documenten
        worden gebruikt.
      </p>
      <div className="mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
        <AdminSettingsForm settings={settings} />
      </div>
      <AdminSettingsRevisions
        revisions={revisions.map((revision) => ({
          ...revision,
          createdAt: revision.createdAt.toISOString(),
        }))}
      />
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h3 className="font-semibold text-ink">Juridische pagina&apos;s</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Conceptteksten moeten vóór livegang inhoudelijk worden goedgekeurd.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {legalPages.map((page) => (
            <li
              key={page.slug}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span>{page.title}</span>
              <span
                className={
                  page.requiresLegalReview
                    ? "font-semibold text-amber-700"
                    : "text-brand-700"
                }
              >
                {page.requiresLegalReview ? "Controle nodig" : "Goedgekeurd"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

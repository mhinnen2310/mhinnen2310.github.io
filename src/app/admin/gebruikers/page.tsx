import Link from "next/link";
import {
  AdminUserControls,
  AdminUserCreateForm,
} from "@/components/admin-user-controls";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getStaffUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Gebruikers & rollen
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Beheer personeel en klantaccounts. Rolwijzigingen zijn alleen voor
            de eigenaar.
          </p>
        </div>
        <Link
          href="/admin/klanten"
          className="text-sm font-semibold text-brand-700 underline"
        >
          Naar klantdossiers
        </Link>
      </div>
    {roleAtLeast(actor?.role, "OWNER") && (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h3 className="font-semibold text-ink">Account toevoegen</h3>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            Gebruik voor personeel of een klant die telefonisch geholpen wordt.
            Laat de gebruiker daarna zelf het wachtwoord wijzigen.
          </p>
          <AdminUserCreateForm />
      </section>
    )}
    <section className="mt-6 rounded-xl border border-line bg-surface p-4"><h3 className="font-semibold text-ink">Rollen en rechten</h3><p className="mt-1 text-sm text-ink-soft">OWNER beheert accounts, rollen en website-instellingen; ADMIN beheert operationele data en accountstatus; STAFF werkt in voorraad, werkplaats, verkoop en service; CUSTOMER heeft alleen het eigen klantaccount.</p></section>
      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Zoek op naam of e-mail"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface">
          Zoeken
        </button>
      </form>
      <div className="mt-4 space-y-3">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-xl border border-line bg-card p-4"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">
                    {user.name ?? "Naam ontbreekt"}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.isActive ? "bg-brand-50 text-brand-800" : "bg-red-50 text-state-error"}`}
                  >
                    {user.isActive ? "Actief" : "Uitgeschakeld"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {user.email} · {user.role} · {user._count.orders}{" "}
                  bestelling(en)
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Aangemaakt {formatDateTime(user.createdAt)}
                </p>
                {user.role === "CUSTOMER" && (
                  <Link
                    href={`/admin/klanten/${user.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-brand-700 underline"
                  >
                    Open klantdossier
                  </Link>
                )}
              </div>
              <AdminUserControls
                user={user}
                canChangeRole={roleAtLeast(actor?.role, "OWNER")}
                canManage={roleAtLeast(actor?.role, "ADMIN")}
              />
            </div>
          </article>
        ))}
        {users.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
            Geen accounts gevonden.
          </p>
        )}
      </div>
    </div>
  );
}

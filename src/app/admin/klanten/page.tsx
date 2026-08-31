import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true } },
      orders: {
        select: { totalCents: true },
        where: { paymentStatus: "PAID" },
      },
    },
  });
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Klantdossiers
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Contactgegevens, aankoopgeschiedenis, facturen, garantie en service
            in één dossier.
          </p>
        </div>
        <Link
          href="/admin/gebruikers"
          className="text-sm font-semibold text-brand-700 underline"
        >
          Gebruikers & rollen
        </Link>
      </div>
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
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Bestellingen</th>
              <th className="px-4 py-3">Betaalde omzet</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">
                    {customer.name ?? "Naam ontbreekt"}
                  </p>
                  <p className="text-xs text-ink-soft">{customer.email}</p>
                </td>
                <td className="px-4 py-3">{customer._count.orders}</td>
                <td className="px-4 py-3">
                  {formatPrice(
                    customer.orders.reduce(
                      (sum, order) => sum + order.totalCents,
                      0,
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {customer.isActive ? "Actief" : "Uitgeschakeld"}
                  <br />
                  <span className="text-ink-faint">
                    {formatDateTime(customer.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/klanten/${customer.id}`}
                    className="font-semibold text-brand-700 underline"
                  >
                    Open dossier
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  Geen klanten gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

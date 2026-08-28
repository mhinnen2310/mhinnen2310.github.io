import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { bikeStatusLabel } from "@/lib/bikes";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBikesPage() {
  const bikes = await prisma.bike.findMany({
    select: {
      id: true,
      inventoryCode: true,
      title: true,
      brand: true,
      model: true,
      status: true,
      priceCents: true,
      updatedAt: true,
      _count: { select: { images: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 250,
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Fietsen</h2>
          <p className="mt-1 text-sm text-ink-soft">Elke regel is één fysieke fiets; maximaal 250 recente records worden getoond.</p>
        </div>
        <Link href="/admin/fietsen/nieuw" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
          Fiets toevoegen
        </Link>
      </div>

      {bikes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-card p-8 text-sm text-ink-soft">
          Er zijn nog geen fietsen. Voeg de eerste fiets toe vanuit de intake.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Fiets</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Vraagprijs</th>
                <th className="px-4 py-3 font-semibold">Foto&apos;s</th>
                <th className="px-4 py-3 font-semibold">Bijgewerkt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bikes.map((bike) => (
                <tr key={bike.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/fietsen/${bike.id}`} className="font-semibold text-brand-800 underline">
                      {bike.title}
                    </Link>
                    <p className="text-xs text-ink-faint">{bike.inventoryCode} · {bike.brand} {bike.model}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{bikeStatusLabel(bike.status)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatPrice(bike.priceCents)}</td>
                  <td className="px-4 py-3 text-ink-soft">{bike._count.images}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(bike.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

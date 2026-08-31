import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bikeStatusLabel, BIKE_STATUSES, daysSinceAcquisition, daysSinceAvailable } from "@/lib/bikes";
import { mediaWidthUrl } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function AdminBikesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = one(params.q)?.trim() ?? "";
  const status = one(params.status) ?? "";
  const brand = one(params.brand) ?? "";
  const electric = one(params.electric) ?? "";
  const bikeType = one(params.type) ?? "";
  const where: Prisma.BikeWhereInput = { AND: [] };
  const and = where.AND as Prisma.BikeWhereInput[];
  if (q) and.push({ OR: [{ inventoryCode: { contains: q } }, { brand: { contains: q } }, { model: { contains: q } }, { frameSerialRef: { contains: q } }] });
  if (BIKE_STATUSES.includes(status as never)) and.push({ status: status as never });
  if (brand) and.push({ brand });
  if (electric === "ja") and.push({ isElectric: true });
  if (electric === "nee") and.push({ isElectric: false });
  if (bikeType) and.push({ bikeType });

  const [bikes, brands, types] = await Promise.all([
    prisma.bike.findMany({
      where,
      select: {
        id: true, inventoryCode: true, title: true, brand: true, model: true, status: true, priceCents: true, acquisitionDate: true, publishedAt: true, createdAt: true, storageLocation: true,
        images: { where: { isInternal: false }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { storageKey: true, width: true, height: true } },
      },
      orderBy: [{ updatedAt: "desc" }], take: 250,
    }),
    prisma.bike.findMany({ distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" }, take: 100 }),
    prisma.bike.findMany({ where: { bikeType: { not: null } }, distinct: ["bikeType"], select: { bikeType: true }, orderBy: { bikeType: "asc" }, take: 100 }),
  ]);

  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight text-ink">Fietsen</h2><p className="mt-1 text-sm text-ink-soft">Elke regel is één fysiek exemplaar. Zoek en filter op de actuele voorraad; maximaal 250 resultaten.</p></div><Link href="/admin/fietsen/nieuw" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Fiets toevoegen</Link></div>
    <form method="get" className="mt-6 grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"><label className="text-xs text-ink-soft lg:col-span-2">Zoeken<input name="q" defaultValue={q} placeholder="Inventarisnr., merk, model, framenummer" className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink" /></label><label className="text-xs text-ink-soft">Status<select name="status" defaultValue={status} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink"><option value="">Alle statussen</option>{BIKE_STATUSES.map((value) => <option key={value} value={value}>{bikeStatusLabel(value)}</option>)}</select></label><label className="text-xs text-ink-soft">Merk<select name="brand" defaultValue={brand} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink"><option value="">Alle merken</option>{brands.map((row) => <option key={row.brand} value={row.brand}>{row.brand}</option>)}</select></label><label className="text-xs text-ink-soft">Elektrisch<select name="electric" defaultValue={electric} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink"><option value="">Alle</option><option value="ja">Elektrisch</option><option value="nee">Niet-elektrisch</option></select></label><label className="text-xs text-ink-soft">Fietstype<select name="type" defaultValue={bikeType} className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm text-ink"><option value="">Alle types</option>{types.map((row) => <option key={row.bikeType} value={row.bikeType ?? ""}>{row.bikeType}</option>)}</select></label><div className="flex items-end gap-2"><button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Filteren</button><Link href="/admin/fietsen" className="pb-2 text-sm text-brand-800 underline">Wis</Link></div></form>
    {bikes.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-line bg-card p-8 text-sm text-ink-soft">Geen fietsen gevonden. Voeg een fiets toe vanuit de intake of pas de filters aan.</div> : <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card"><table className="min-w-full text-left text-sm"><thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-faint"><tr><th className="px-4 py-3 font-semibold">Fiets</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Vraagprijs</th><th className="px-4 py-3 font-semibold">Binnen / beschikbaar</th><th className="px-4 py-3 font-semibold">Locatie</th></tr></thead><tbody className="divide-y divide-line">{bikes.map((bike) => { const image = bike.images[0]; const daysAvailable = daysSinceAvailable(bike); return <tr key={bike.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{image ? <Image src={mediaWidthUrl(image.storageKey, 256)} alt="" width={Math.max(1, image.width)} height={Math.max(1, image.height)} unoptimized className="h-12 w-12 rounded-md object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface text-xs text-ink-faint">Geen foto</div>}<div><Link href={`/admin/fietsen/${bike.id}`} className="font-semibold text-brand-800 underline">{bike.title}</Link><p className="text-xs text-ink-faint">{bike.inventoryCode} · {bike.brand} {bike.model}</p></div></div></td><td className="px-4 py-3 text-ink-soft">{bikeStatusLabel(bike.status)}</td><td className="px-4 py-3 text-ink-soft">{formatPrice(bike.priceCents)}</td><td className="px-4 py-3 text-ink-soft"><p>{formatDate(bike.acquisitionDate ?? bike.createdAt)} · {daysSinceAcquisition(bike)} d.</p><p className="text-xs text-ink-faint">{daysAvailable == null ? "Nog niet beschikbaar geweest" : `${daysAvailable} d. beschikbaar${daysAvailable > 60 ? " · aandacht" : ""}`}</p></td><td className="px-4 py-3 text-ink-soft">{bike.storageLocation ?? "—"}</td></tr>; })}</tbody></table></div>}
  </div>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffUser } from "@/lib/admin-auth";
import { findPublicBikeBySlug } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { publicQrState } from "@/lib/qr-tags";

export const dynamic = "force-dynamic";

export default async function QrTagPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) notFound();
  const [tag, staff] = await Promise.all([
    prisma.qrTag.findUnique({ where: { secureToken: token }, select: { id: true, displayCode: true, status: true, bike: { select: { id: true, slug: true, inventoryCode: true, title: true, status: true } } } }),
    getStaffUser(),
  ]);
  if (!tag) notFound();
  const publicBike = tag.status === "BOUND" && tag.bike ? await findPublicBikeBySlug(tag.bike.slug) : null;
  if (staff) return <main className="mx-auto max-w-xl px-4 py-12"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">QR asset-tag</p><h1 className="mt-1 text-3xl font-bold text-ink">{tag.displayCode}</h1><p className="mt-3 text-ink-soft">{tag.status === "UNUSED" ? "Ongebruikt" : tag.status === "BOUND" ? "Gekoppeld" : "Ingetrokken"}</p>{tag.bike ? <div className="mt-5 rounded-xl border border-line bg-card p-5"><strong>{tag.bike.title}</strong><p className="mt-1 text-sm text-ink-soft">{tag.bike.inventoryCode} · {tag.bike.status}</p><div className="mt-3 flex gap-3"><Link href={`/admin/fietsen/${tag.bike.id}`} className="text-sm font-semibold text-brand-800 underline">Open dossier</Link><Link href={`/admin/fietsen/${tag.bike.id}#werkplaats`} className="text-sm font-semibold text-brand-800 underline">Werkplaats</Link></div></div> : <Link href={`/admin/qr-labels/${tag.id}`} className="mt-5 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Koppel aan fiets</Link>}</main>;
  if (!publicBike) return <main className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold text-ink">Demi Fietsen</h1><p className="mt-3 text-ink-soft">{publicQrState(tag.status)}</p></main>;
  return <main className="mx-auto max-w-xl px-4 py-12"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Demi Fietsen</p><h1 className="mt-1 text-3xl font-bold text-ink">{publicBike.public.title}</h1><p className="mt-2 text-ink-soft">{publicBike.public.brand} {publicBike.public.model}</p><Link href={`/fietsen/${publicBike.public.slug}`} className="mt-5 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Bekijk fiets</Link></main>;
}

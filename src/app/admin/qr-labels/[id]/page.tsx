import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminQrBindForm, AdminQrCorrectForm, AdminQrRetireForm } from "@/components/admin-qr-bind-form";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function QrTagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tag, actor] = await Promise.all([
    prisma.qrTag.findUnique({ where: { id }, include: { batch: true, bike: { select: { id: true, inventoryCode: true, title: true, status: true } } } }),
    getStaffUser(),
  ]);
  if (!tag) notFound();
  const canCorrect = roleAtLeast(actor?.role, "ADMIN");
  return <div><Link href="/admin/qr-labels" className="text-sm text-brand-800 underline">← QR-labels</Link><h2 className="mt-3 text-2xl font-bold text-ink">{tag.displayCode}</h2><p className="mt-1 text-sm text-ink-soft">{tag.status} · {tag.batch.batchNumber}</p>{tag.status === "UNUSED" ? <><AdminQrBindForm tagId={tag.id} displayCode={tag.displayCode} />{canCorrect && <AdminQrRetireForm tagId={tag.id} />}</> : tag.bike ? <><div className="mt-5 rounded-xl border border-line bg-card p-5"><strong>{tag.bike.title}</strong><p className="mt-1 text-sm text-ink-soft">{tag.bike.inventoryCode} · {tag.bike.status}</p><Link href={`/admin/fietsen/${tag.bike.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-800 underline">Open fietsdossier</Link></div>{canCorrect && <AdminQrCorrectForm tagId={tag.id} currentInventoryCode={tag.bike.inventoryCode} />}</> : <p className="mt-5 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">Deze QR-tag is ingetrokken en kan niet meer worden gekoppeld.</p>}</div>;
}

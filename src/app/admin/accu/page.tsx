import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { AdminBatteryCreateForm, AdminBatteryList, type BatteryRow, batteryStatusLabels, type BatteryStatusValue } from "@/components/admin-battery-manager";
import { prisma } from "@/lib/prisma";
import { numericValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function AdminBatteriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = one(params.q)?.trim() ?? "";
  const status = one(params.status) ?? "";
  const where: Prisma.BatteryWhereInput = { AND: [] };
  const and = where.AND as Prisma.BatteryWhereInput[];
  if (q) and.push({ OR: [{ assetCode: { contains: q, mode: "insensitive" } }, { serialNumber: { contains: q, mode: "insensitive" } }, { manufacturer: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] });
  if (Object.prototype.hasOwnProperty.call(batteryStatusLabels, status)) and.push({ status: status as BatteryStatusValue });
  const rows = await prisma.battery.findMany({ where, include: { currentBike: { select: { id: true, inventoryCode: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 500 });
  const batteries: BatteryRow[] = rows.map((battery) => ({ ...battery, nominalWh: battery.nominalWh, sohPercent: numericValue(battery.sohPercent), updatedAt: battery.updatedAt, currentBike: battery.currentBike }));
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight text-ink">Accu’s</h2><p className="mt-1 max-w-2xl text-sm text-ink-soft">Elke accu is een apart fysiek dossier. Registreer, test en repareer hem los; koppel hem pas aan een fiets wanneer dat nodig is.</p></div><Link href="/admin/fietsen" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface">Naar fietsen</Link></div><AdminBatteryCreateForm /><form method="get" className="mt-5 flex flex-wrap gap-2 rounded-xl border border-line bg-card p-4"><input name="q" defaultValue={q} placeholder="Zoek ACC-code, serienummer, merk of model" className="min-w-[220px] flex-1 rounded-lg border border-line px-3 py-2 text-sm" /><select name="status" defaultValue={status} className="rounded-lg border border-line px-3 py-2 text-sm"><option value="">Alle statussen</option>{(Object.keys(batteryStatusLabels) as BatteryStatusValue[]).map((value) => <option key={value} value={value}>{batteryStatusLabels[value]}</option>)}</select><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Zoeken</button>{(q || status) && <Link href="/admin/accu" className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft">Wis</Link>}</form><AdminBatteryList batteries={batteries} /></div>;
}

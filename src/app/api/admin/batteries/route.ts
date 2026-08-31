import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getStaffUser } from "@/lib/admin-auth";
import { BatteryError, createBatteryAsset, BATTERY_STATUSES } from "@/lib/batteries";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "";
  const where: Prisma.BatteryWhereInput = { AND: [] };
  const and = where.AND as Prisma.BatteryWhereInput[];
  if (q) and.push({ OR: [{ assetCode: { contains: q, mode: "insensitive" } }, { serialNumber: { contains: q, mode: "insensitive" } }, { manufacturer: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] });
  if (BATTERY_STATUSES.includes(status as (typeof BATTERY_STATUSES)[number])) and.push({ status: status as never });
  const batteries = await prisma.battery.findMany({ where, include: { currentBike: { select: { id: true, inventoryCode: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 500 });
  return NextResponse.json(batteries);
}

export async function POST(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const battery = await createBatteryAsset(body, actor);
    return NextResponse.json(battery, { status: 201 });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Deze accucode bestaat al." }, { status: 409 });
    console.error("admin battery create failed", error);
    return NextResponse.json({ error: "De accu kon niet worden aangemaakt." }, { status: 500 });
  }
}

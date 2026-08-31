import { NextResponse } from "next/server";
import { createBatteryAsset, BatteryError, BATTERY_STATUSES } from "@/lib/batteries";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const batteries = await prisma.battery.findMany({ where: {
    ...(status && BATTERY_STATUSES.includes(status as (typeof BATTERY_STATUSES)[number]) ? { status: status as never } : {}),
    ...(q ? { OR: [{ assetCode: { contains: q, mode: "insensitive" } }, { serialNumber: { contains: q, mode: "insensitive" } }, { manufacturer: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] } : {}),
  }, include: { currentBike: { select: { id: true, inventoryCode: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return mobileOk({ batteries });
}

export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try { return mobileOk(await createBatteryAsset(body, actor), 201); } catch (error) {
    if (error instanceof BatteryError) return mobileError(error, "Accu kon niet worden aangemaakt.");
    console.error("mobile battery create failed", error); return NextResponse.json({ error: "De accu kon niet worden aangemaakt." }, { status: 500 });
  }
}

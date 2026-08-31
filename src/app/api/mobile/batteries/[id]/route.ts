import { NextResponse } from "next/server";
import { BatteryError, updateBatteryAsset } from "@/lib/batteries";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  const battery = await prisma.battery.findUnique({ where: { id }, include: { currentBike: { select: { id: true, inventoryCode: true, title: true } }, assignments: { orderBy: { assignedAt: "desc" }, include: { bike: { select: { id: true, inventoryCode: true, title: true } } } }, repairs: { orderBy: { createdAt: "desc" } } } });
  if (!battery) return NextResponse.json({ error: "Accu niet gevonden." }, { status: 404 });
  return mobileOk({ battery });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try { await updateBatteryAsset(id, body, actor); return mobileOk({ ok: true }); } catch (error) {
    if (error instanceof BatteryError) return mobileError(error, "Accudossier kon niet worden opgeslagen.");
    console.error("mobile battery update failed", error); return NextResponse.json({ error: "Accudossier kon niet worden opgeslagen." }, { status: 500 });
  }
}

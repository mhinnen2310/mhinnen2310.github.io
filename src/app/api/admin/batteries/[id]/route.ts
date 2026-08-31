import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { BatteryError, updateBatteryAsset } from "@/lib/batteries";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  const battery = await prisma.battery.findUnique({ where: { id }, include: {
    currentBike: { select: { id: true, inventoryCode: true, title: true } },
    assignments: { orderBy: { assignedAt: "desc" }, include: { bike: { select: { id: true, inventoryCode: true, title: true } }, changedBy: { select: { name: true, email: true } } } },
    repairs: { orderBy: { createdAt: "desc" }, include: { completedBy: { select: { name: true, email: true } } } },
  } });
  if (!battery) return NextResponse.json({ error: "Accu niet gevonden." }, { status: 404 });
  return NextResponse.json(battery);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const battery = await updateBatteryAsset(id, body, actor);
    return NextResponse.json({ id: battery.id });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin battery update failed", error);
    return NextResponse.json({ error: "Het accudossier kon niet worden opgeslagen." }, { status: 500 });
  }
}

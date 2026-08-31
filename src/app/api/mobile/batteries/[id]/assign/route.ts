import { NextResponse } from "next/server";
import { assignBatteryToBike, BatteryError, unassignBatteryFromBike } from "@/lib/batteries";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params; let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.bikeId !== "string") return NextResponse.json({ error: "Fiets ontbreekt." }, { status: 400 });
  try { await assignBatteryToBike(id, body.bikeId, actor, typeof body.note === "string" ? body.note : null); return mobileOk({ ok: true }); } catch (error) { if (error instanceof BatteryError) return mobileError(error, "Accu kon niet worden gekoppeld."); console.error("mobile battery assignment failed", error); return NextResponse.json({ error: "Accu kon niet worden gekoppeld." }, { status: 500 }); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  try { await unassignBatteryFromBike(id, actor); return mobileOk({ ok: true }); } catch (error) { if (error instanceof BatteryError) return mobileError(error, "Accu kon niet worden losgekoppeld."); console.error("mobile battery unassignment failed", error); return NextResponse.json({ error: "Accu kon niet worden losgekoppeld." }, { status: 500 }); }
}

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { assignBatteryToBike, BatteryError, unassignBatteryFromBike } from "@/lib/batteries";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* an empty body is valid for a simple attach */ }
  if (typeof body.bikeId !== "string" || !body.bikeId) return NextResponse.json({ error: "Kies eerst een fiets." }, { status: 400 });
  try {
    await assignBatteryToBike(id, body.bikeId, actor, typeof body.note === "string" ? body.note : null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("battery assignment failed", error);
    return NextResponse.json({ error: "De accu kon niet worden gekoppeld." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no note */ }
  try {
    await unassignBatteryFromBike(id, actor, typeof body.note === "string" ? body.note : null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("battery unassignment failed", error);
    return NextResponse.json({ error: "De accu kon niet worden losgekoppeld." }, { status: 500 });
  }
}

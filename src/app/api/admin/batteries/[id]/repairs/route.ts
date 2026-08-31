import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { addBatteryRepair, BatteryError, deleteBatteryRepair, updateBatteryRepair } from "@/lib/batteries";

function cents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function integer(value: unknown, fallback: number | null = null): number | null {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function date(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const repair = await addBatteryRepair(id, { description: typeof body.description === "string" ? body.description : "", partName: typeof body.partName === "string" ? body.partName : null, partCostCents: cents(body.partCostCents), quantity: integer(body.quantity, 1) ?? 1, labourMinutes: integer(body.labourMinutes), labourCostCents: cents(body.labourCostCents), internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : null, completed: body.completed === true, doneDate: date(body.doneDate) }, actor);
    return NextResponse.json({ id: repair.id }, { status: 201 });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("battery repair create failed", error);
    return NextResponse.json({ error: "De accureparatie kon niet worden opgeslagen." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.repairId !== "string") return NextResponse.json({ error: "Reparatie ontbreekt." }, { status: 400 });
  try {
    await updateBatteryRepair(id, body.repairId, { description: typeof body.description === "string" ? body.description : undefined, partName: typeof body.partName === "string" ? body.partName : undefined, partCostCents: body.partCostCents === undefined ? undefined : cents(body.partCostCents), quantity: body.quantity === undefined ? undefined : (integer(body.quantity) ?? 1), labourMinutes: body.labourMinutes === undefined ? undefined : integer(body.labourMinutes), labourCostCents: body.labourCostCents === undefined ? undefined : cents(body.labourCostCents), internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : undefined, completed: body.completed === undefined ? undefined : body.completed === true, doneDate: body.doneDate === undefined ? undefined : date(body.doneDate) }, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("battery repair update failed", error);
    return NextResponse.json({ error: "De accureparatie kon niet worden bijgewerkt." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.repairId !== "string") return NextResponse.json({ error: "Reparatie ontbreekt." }, { status: 400 });
  try { await deleteBatteryRepair(id, body.repairId, actor); return NextResponse.json({ ok: true }); } catch (error) {
    if (error instanceof BatteryError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("battery repair delete failed", error);
    return NextResponse.json({ error: "De accureparatie kon niet worden verwijderd." }, { status: 500 });
  }
}

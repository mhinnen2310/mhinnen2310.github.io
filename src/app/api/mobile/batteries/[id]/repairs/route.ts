import { NextResponse } from "next/server";
import { addBatteryRepair, BatteryError, updateBatteryRepair } from "@/lib/batteries";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";

const numberOrNull = (value: unknown) => value == null || value === "" ? null : Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params; let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try { const repair = await addBatteryRepair(id, { description: typeof body.description === "string" ? body.description : "", partName: typeof body.partName === "string" ? body.partName : null, partCostCents: numberOrNull(body.partCostCents), quantity: numberOrNull(body.quantity) ?? 1, labourMinutes: numberOrNull(body.labourMinutes), labourCostCents: numberOrNull(body.labourCostCents), internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : null, completed: body.completed === true, doneDate: null }, actor); return mobileOk({ id: repair.id }, 201); } catch (error) { if (error instanceof BatteryError) return mobileError(error, "Accureparatie kon niet worden opgeslagen."); console.error("mobile battery repair failed", error); return NextResponse.json({ error: "Accureparatie kon niet worden opgeslagen." }, { status: 500 }); }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params; let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.repairId !== "string") return NextResponse.json({ error: "Reparatie ontbreekt." }, { status: 400 });
  try { await updateBatteryRepair(id, body.repairId, { completed: body.completed === true }, actor); return mobileOk({ ok: true }); } catch (error) { if (error instanceof BatteryError) return mobileError(error, "Accureparatie kon niet worden bijgewerkt."); console.error("mobile battery repair update failed", error); return NextResponse.json({ error: "Accureparatie kon niet worden bijgewerkt." }, { status: 500 }); }
}

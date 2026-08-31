import type { InspectionResult } from "@prisma/client";
import { NextResponse } from "next/server";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { addWorkshopTask, completeWorkshopTask, isInspectionKey, WorkshopError } from "@/lib/workshop";

const RESULTS: InspectionResult[] = ["PASS", "ATTENTION", "FAIL", "NOT_APPLICABLE"];
function text(value: unknown, label: string, max: number, required = false): string | null {
  if (value == null || value === "") { if (required) throw new WorkshopError(`${label} is verplicht.`); return null; }
  if (typeof value !== "string" || value.trim().length > max) throw new WorkshopError(`${label} is ongeldig.`);
  return value.trim() || null;
}
function integer(value: unknown, label: string, min: number, max: number, fallback?: number): number | null {
  if (value == null || value === "") return fallback ?? null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new WorkshopError(`${label} is ongeldig.`);
  return value;
}
function date(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) throw new WorkshopError("Datum is ongeldig.");
  return new Date(value);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const checklistKey = body.checklistKey == null ? null : typeof body.checklistKey === "string" && isInspectionKey(body.checklistKey) ? body.checklistKey : (() => { throw new WorkshopError("Inspectiepunt is ongeldig."); })();
    const inspectionResult = body.inspectionResult == null ? null : typeof body.inspectionResult === "string" && RESULTS.includes(body.inspectionResult as InspectionResult) ? body.inspectionResult as InspectionResult : (() => { throw new WorkshopError("Inspectieresultaat is ongeldig."); })();
    const task = await addWorkshopTask(id, {
      description: text(body.description, "Werkzaamheid", 500, !checklistKey) ?? "", checklistKey, inspectionResult,
      partName: text(body.partName, "Onderdeel", 250), partCostCents: integer(body.partCostCents, "Onderdeelprijs", 0, 100_000_000),
      quantity: integer(body.quantity, "Aantal", 1, 999, 1) ?? 1, labourMinutes: integer(body.labourMinutes, "Arbeidstijd", 0, 100_000),
      labourCostCents: integer(body.labourCostCents, "Arbeidskosten", 0, 100_000_000), internalNotes: text(body.internalNotes, "Interne notitie", 4_000),
      doneDate: date(body.doneDate), completed: body.completed === true,
    }, actor);
    return mobileOk({ task }, 201);
  } catch (error) {
    if (error instanceof WorkshopError) return mobileError(error, "Werkplaatsregel kon niet worden opgeslagen.");
    console.error("mobile service task create failed", error); return NextResponse.json({ error: "Werkplaatsregel kon niet worden opgeslagen." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  let body: { taskId?: unknown; completed?: unknown; inspectionResult?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.taskId !== "string" || typeof body.completed !== "boolean") return NextResponse.json({ error: "Ongeldige werkplaatsactie." }, { status: 400 });
  const result = body.inspectionResult == null ? undefined : typeof body.inspectionResult === "string" && RESULTS.includes(body.inspectionResult as InspectionResult) ? body.inspectionResult as InspectionResult : null;
  if (result === null) return NextResponse.json({ error: "Inspectieresultaat is ongeldig." }, { status: 400 });
  try { await completeWorkshopTask(id, body.taskId, body.completed, actor, result); return mobileOk({ ok: true }); }
  catch (error) { if (error instanceof WorkshopError) return mobileError(error, "Werkplaatsregel kon niet worden bijgewerkt."); console.error("mobile task update failed", error); return NextResponse.json({ error: "Werkplaatsregel kon niet worden bijgewerkt." }, { status: 500 }); }
}

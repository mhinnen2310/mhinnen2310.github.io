import type { InspectionResult } from "@prisma/client";
import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { addWorkshopTask, completeWorkshopTask, WorkshopError } from "@/lib/workshop";

const RESULTS: InspectionResult[] = ["PASS", "ATTENTION", "FAIL", "NOT_APPLICABLE"];

function text(value: unknown, label: string, max: number, required = false): string | null {
  if (value == null || value === "") {
    if (required) throw new WorkshopError(`${label} is verplicht.`);
    return null;
  }
  if (typeof value !== "string") throw new WorkshopError(`${label} is ongeldig.`);
  const result = value.trim();
  if (!result && required) throw new WorkshopError(`${label} is verplicht.`);
  if (result.length > max) throw new WorkshopError(`${label} is te lang.`);
  return result || null;
}

function integer(value: unknown, label: string, min: number, max: number, fallback?: number): number | null {
  if (value == null || value === "") return fallback ?? null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new WorkshopError(`${label} is ongeldig.`);
  return value;
}

function date(value: unknown, label: string): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new WorkshopError(`${label} is ongeldig.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new WorkshopError(`${label} is ongeldig.`);
  return parsed;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const quantity = integer(body.quantity, "Aantal", 1, 999, 1);
    const task = await addWorkshopTask(bikeId, {
      description: text(body.description, "Werkzaamheden", 500, true)!,
      partName: text(body.partName, "Onderdeel", 250),
      partCostCents: integer(body.partCostCents, "Onderdeelprijs", 0, 100_000_000),
      quantity: quantity ?? 1,
      labourMinutes: integer(body.labourMinutes, "Arbeidstijd", 0, 100_000),
      labourCostCents: integer(body.labourCostCents, "Arbeidskosten", 0, 100_000_000),
      internalNotes: text(body.internalNotes, "Interne notitie", 4_000),
      doneDate: date(body.doneDate, "Uitvoerdatum"),
      completed: body.completed === true,
    }, actor);
    return NextResponse.json({ id: task.id }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkshopError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin service task create failed", error);
    return NextResponse.json({ error: "De werkplaatsregel kon niet worden opgeslagen." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.taskId !== "string" || typeof body.completed !== "boolean") return NextResponse.json({ error: "Ongeldige werkplaatsactie." }, { status: 400 });
  const inspectionResult = body.inspectionResult == null ? undefined : typeof body.inspectionResult === "string" && RESULTS.includes(body.inspectionResult as InspectionResult) ? body.inspectionResult as InspectionResult : null;
  if (inspectionResult === null) return NextResponse.json({ error: "Ongeldig inspectieresultaat." }, { status: 400 });
  try {
    await completeWorkshopTask(bikeId, body.taskId, body.completed, actor, inspectionResult);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkshopError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin service task update failed", error);
    return NextResponse.json({ error: "De werkplaatsregel kon niet worden bijgewerkt." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { WorkshopError, saveBikeIntake } from "@/lib/workshop";

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new WorkshopError(`${label} is ongeldig.`);
  return value;
}

function text(value: unknown, label: string, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new WorkshopError(`${label} is ongeldig.`);
  const result = value.trim();
  if (result.length > max) throw new WorkshopError(`${label} is te lang.`);
  return result || null;
}

function date(value: unknown, label: string): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new WorkshopError(`${label} is ongeldig.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new WorkshopError(`${label} is ongeldig.`);
  return parsed;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    await saveBikeIntake(bikeId, {
      frameSerialPresent: boolean(body.frameSerialPresent, "Framenummercontrole"),
      keysPresent: boolean(body.keysPresent, "Sleutelcontrole"),
      chargerPresent: boolean(body.chargerPresent, "Ladercontrole"),
      batteryPresent: boolean(body.batteryPresent, "Accucontrole"),
      defectsAssessed: boolean(body.defectsAssessed, "Gebrekencontrole"),
      knownDefects: text(body.knownDefects, "Bekende gebreken", 4_000),
      theftCheckCompleted: boolean(body.theftCheckCompleted, "Diefstalcontrole"),
      theftCheckDate: date(body.theftCheckDate, "Datum diefstalcontrole"),
      theftCheckResult: text(body.theftCheckResult, "Resultaat diefstalcontrole", 1_000),
    }, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkshopError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin intake save failed", error);
    return NextResponse.json({ error: "De intake kon niet worden opgeslagen." }, { status: 500 });
  }
}

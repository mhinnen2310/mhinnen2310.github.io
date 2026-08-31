import { NextResponse } from "next/server";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { saveBikeIntake, WorkshopError } from "@/lib/workshop";

function bool(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new WorkshopError(`${label} is ongeldig.`);
  return value;
}
function text(value: unknown, label: string, max: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new WorkshopError(`${label} is ongeldig.`);
  return value.trim() || null;
}
function date(value: unknown, label: string) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new WorkshopError(`${label} is ongeldig.`);
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new WorkshopError(`${label} is ongeldig.`);
  return result;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const intake = await saveBikeIntake(id, {
      frameSerialPresent: bool(body.frameSerialPresent, "Framenummercontrole"), keysPresent: bool(body.keysPresent, "Sleutelcontrole"),
      chargerPresent: bool(body.chargerPresent, "Ladercontrole"), batteryPresent: bool(body.batteryPresent, "Accucontrole"),
      defectsAssessed: bool(body.defectsAssessed, "Gebrekencontrole"), knownDefects: text(body.knownDefects, "Bekende gebreken", 4_000),
      theftCheckCompleted: bool(body.theftCheckCompleted, "Diefstalcontrole"), theftCheckDate: date(body.theftCheckDate, "Datum diefstalcontrole"),
      theftCheckResult: text(body.theftCheckResult, "Resultaat diefstalcontrole", 1_000),
    }, actor);
    return mobileOk({ intake });
  } catch (error) {
    if (error instanceof WorkshopError) return mobileError(error, "Intake kon niet worden opgeslagen.");
    console.error("mobile intake update failed", error);
    return NextResponse.json({ error: "De intake kon niet worden opgeslagen." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { BikeAdminError, updateBike } from "@/lib/bike-admin";
import { BikeInputError, parseBikeUpdate } from "@/lib/bike-input";
import { getIntakeReadiness, getWorkshopReadiness } from "@/lib/workshop";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

/** Complete staff dossier. This is never exposed on a public bike endpoint. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  const { id } = await ctx.params;
  const bike = await prisma.bike.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, storageKey: true, isInternal: true, isCover: true, width: true, height: true } },
      intakeRecord: true,
      qrTag: { select: { id: true, displayCode: true, status: true } },
      serviceTasks: {
        orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
        include: { completedBy: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!bike) return NextResponse.json({ error: "Fiets niet gevonden." }, { status: 404, headers: { "cache-control": "no-store" } });
  const [intakeReadiness, workshopReadiness] = await Promise.all([getIntakeReadiness(id), getWorkshopReadiness(id)]);
  return mobileOk({ bike, readiness: { intake: intakeReadiness, workshop: workshopReadiness } });
}

/** Mobile uses the identical validated dossier update as browser administration. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  try {
    const data = parseBikeUpdate(body);
    await updateBike(id, data, actor);
    return mobileOk({ ok: true });
  } catch (error) {
    if (error instanceof BikeAdminError || error instanceof BikeInputError) return mobileError(error, "Fietsdossier kon niet worden opgeslagen.");
    console.error("mobile bike update failed", error);
    return NextResponse.json({ error: "Fietsdossier kon niet worden opgeslagen." }, { status: 500 });
  }
}

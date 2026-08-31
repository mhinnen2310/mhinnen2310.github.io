import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { addBikeImage, BikeImageError } from "@/lib/bike-images";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Mobile camera upload; processing, storage and audit are shared with web admin. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ error: "Kies eerst een afbeelding." }, { status: 400 });
    return mobileOk({ image: await addBikeImage(id, image, actor) }, 201);
  } catch (error) {
    if (error instanceof BikeImageError) return mobileError(error, "Afbeelding kon niet worden toegevoegd.");
    console.error("mobile bike image upload failed", error); return NextResponse.json({ error: "Afbeelding kon niet worden toegevoegd." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id: bikeId } = await ctx.params;
  let body: { action?: unknown; imageId?: unknown; isInternal?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.imageId !== "string" || !body.imageId) return NextResponse.json({ error: "Foto ontbreekt." }, { status: 400 });
  const imageId = body.imageId;
  try {
    if (body.action === "cover") {
      await prisma.$transaction(async (tx) => {
        const target = await tx.bikeImage.findFirst({ where: { id: imageId, bikeId }, select: { id: true, isInternal: true } });
        if (!target) throw new Error("Foto niet gevonden."); if (target.isInternal) throw new Error("Een interne foto kan geen omslagfoto zijn.");
        await tx.bikeImage.updateMany({ where: { bikeId }, data: { isCover: false } }); await tx.bikeImage.update({ where: { id: target.id }, data: { isCover: true } });
      });
    } else if (body.action === "visibility" && typeof body.isInternal === "boolean") {
      await prisma.$transaction(async (tx) => {
        const isInternal = body.isInternal as boolean;
        const target = await tx.bikeImage.findFirst({ where: { id: imageId, bikeId } }); if (!target) throw new Error("Foto niet gevonden.");
        await tx.bikeImage.update({ where: { id: target.id }, data: { isInternal, ...(isInternal && target.isCover ? { isCover: false } : {}) } });
        if (isInternal && target.isCover) { const next = await tx.bikeImage.findFirst({ where: { bikeId, isInternal: false, id: { not: target.id } }, orderBy: { sortOrder: "asc" } }); if (next) await tx.bikeImage.update({ where: { id: next.id }, data: { isCover: true } }); }
      });
    } else return NextResponse.json({ error: "Ongeldige fotoactie." }, { status: 400 });
    await audit("mobile.bike_image_updated", "Bike", bikeId, { action: body.action, imageId: body.imageId }, actor);
    return mobileOk({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Foto kon niet worden bijgewerkt." }, { status: 400 }); }
}

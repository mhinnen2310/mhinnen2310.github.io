import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { BikeImageError, addBikeImage } from "@/lib/bike-images";
import { deleteProcessedImage } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;

  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Kies eerst een afbeelding." }, { status: 400 });
    }
    const created = await addBikeImage(bikeId, image, actor);
    return NextResponse.json({ image: created }, { status: 201 });
  } catch (error) {
    if (error instanceof BikeImageError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike image upload failed", error);
    return NextResponse.json({ error: "De afbeelding kon niet worden verwerkt." }, { status: 500 });
  }
}

function imageIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some((id) => typeof id !== "string" || !id)) {
    throw new Error("De fotovolgorde is ongeldig.");
  }
  const ids = value as string[];
  if (new Set(ids).size !== ids.length) throw new Error("De fotovolgorde is ongeldig.");
  return ids;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    if (body.action === "reorder") {
      const ids = imageIds(body.ids);
      await prisma.$transaction(async (tx) => {
        const current = await tx.bikeImage.findMany({ where: { bikeId }, select: { id: true } });
        if (current.length !== ids.length || current.some((image) => !ids.includes(image.id))) {
          throw new Error("De fotovolgorde hoort niet bij deze fiets.");
        }
        await Promise.all(ids.map((id, sortOrder) => tx.bikeImage.update({ where: { id }, data: { sortOrder } })));
      });
      await audit("bike.images_reordered", "Bike", bikeId, { count: ids.length }, actor);
      return NextResponse.json({ ok: true });
    }

    if (typeof body.imageId !== "string" || !body.imageId) throw new Error("Foto ontbreekt.");
    if (body.action === "cover") {
      await prisma.$transaction(async (tx) => {
        const target = await tx.bikeImage.findFirst({ where: { id: body.imageId as string, bikeId }, select: { id: true, isInternal: true } });
        if (!target) throw new Error("Foto niet gevonden.");
        if (target.isInternal) throw new Error("Een interne foto kan niet als publieke omslagfoto worden gebruikt.");
        await tx.bikeImage.updateMany({ where: { bikeId }, data: { isCover: false } });
        await tx.bikeImage.update({ where: { id: target.id }, data: { isCover: true } });
      });
      await audit("bike.image_cover_set", "Bike", bikeId, { imageId: body.imageId }, actor);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "visibility") {
      const isInternal = body.isInternal;
      if (typeof isInternal !== "boolean") throw new Error("Fotozichtbaarheid is ongeldig.");
      await prisma.$transaction(async (tx) => {
        const target = await tx.bikeImage.findFirst({ where: { id: body.imageId as string, bikeId } });
        if (!target) throw new Error("Foto niet gevonden.");
        await tx.bikeImage.update({ where: { id: target.id }, data: { isInternal } });
        if (isInternal && target.isCover) {
          const nextPublic = await tx.bikeImage.findFirst({ where: { bikeId, isInternal: false, id: { not: target.id } }, orderBy: { sortOrder: "asc" } });
          if (nextPublic) await tx.bikeImage.update({ where: { id: nextPublic.id }, data: { isCover: true } });
          await tx.bikeImage.update({ where: { id: target.id }, data: { isCover: false } });
        }
      });
      await audit("bike.image_visibility_changed", "Bike", bikeId, { imageId: body.imageId, isInternal }, actor);
      return NextResponse.json({ ok: true });
    }

    throw new Error("Onbekende fotoactie.");
  } catch (error) {
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike image update failed", error);
    return NextResponse.json({ error: "De foto kon niet worden bijgewerkt." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.imageId !== "string" || !body.imageId) return NextResponse.json({ error: "Foto ontbreekt." }, { status: 400 });

  try {
    const removed = await prisma.$transaction(async (tx) => {
      const target = await tx.bikeImage.findFirst({ where: { id: body.imageId as string, bikeId } });
      if (!target) throw new Error("Foto niet gevonden.");
      await tx.bikeImage.delete({ where: { id: target.id } });
      if (target.isCover) {
        const nextPublic = await tx.bikeImage.findFirst({ where: { bikeId, isInternal: false }, orderBy: { sortOrder: "asc" } });
        if (nextPublic) await tx.bikeImage.update({ where: { id: nextPublic.id }, data: { isCover: true } });
      }
      return target;
    });
    await deleteProcessedImage(removed.storageKey);
    await audit("bike.image_removed", "Bike", bikeId, { imageId: removed.id }, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike image delete failed", error);
    return NextResponse.json({ error: "De foto kon niet worden verwijderd." }, { status: 500 });
  }
}

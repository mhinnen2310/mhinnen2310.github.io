import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { MAX_UPLOAD_BYTES, processImageUpload } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

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
    if (!ACCEPTED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ error: "Gebruik een JPEG, PNG, WebP, AVIF of GIF-afbeelding." }, { status: 400 });
    }
    if (image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "De afbeelding is leeg of groter dan 20 MB." }, { status: 400 });
    }

    const bike = await prisma.bike.findUnique({ where: { id: bikeId }, select: { id: true } });
    if (!bike) return NextResponse.json({ error: "Fiets niet gevonden." }, { status: 404 });

    const processed = await processImageUpload(Buffer.from(await image.arrayBuffer()), image.type, "bikes");
    const [imageCount, lastImage] = await Promise.all([
      prisma.bikeImage.count({ where: { bikeId } }),
      prisma.bikeImage.findFirst({ where: { bikeId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
    ]);
    const created = await prisma.bikeImage.create({
      data: {
        bikeId,
        storageKey: processed.key,
        width: processed.width,
        height: processed.height,
        sortOrder: (lastImage?.sortOrder ?? -1) + 1,
        isCover: imageCount === 0,
      },
      select: { id: true, storageKey: true, width: true, height: true, isCover: true },
    });
    await audit("bike.image_added", "Bike", bikeId, { imageId: created.id }, actor);
    return NextResponse.json({ image: created }, { status: 201 });
  } catch (error) {
    console.error("admin bike image upload failed", error);
    return NextResponse.json({ error: "De afbeelding kon niet worden verwerkt." }, { status: 500 });
  }
}

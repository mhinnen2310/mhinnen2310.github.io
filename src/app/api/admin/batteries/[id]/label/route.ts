import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { deleteProcessedImage, MAX_UPLOAD_BYTES, processImageUpload } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const form = await req.formData();
    const image = form.get("image") ?? form.get("file");
    if (!(image instanceof File) || !TYPES.has(image.type) || image.size <= 0 || image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Gebruik een geldige afbeelding van maximaal 20 MB." }, { status: 400 });
    const battery = await prisma.battery.findUnique({ where: { id }, select: { id: true, labelPhotoKey: true } });
    if (!battery) return NextResponse.json({ error: "Accu niet gevonden." }, { status: 404 });
    const processed = await processImageUpload(Buffer.from(await image.arrayBuffer()), image.type, "battery-labels");
    await prisma.battery.update({ where: { id }, data: { labelPhotoKey: processed.key } });
    if (battery.labelPhotoKey && battery.labelPhotoKey !== processed.key) await deleteProcessedImage(battery.labelPhotoKey);
    await audit("battery.label_added", "Battery", id, null, actor);
    return NextResponse.json({ key: processed.key }, { status: 201 });
  } catch (error) {
    console.error("battery label upload failed", error);
    return NextResponse.json({ error: "Het acculabel kon niet worden verwerkt." }, { status: 500 });
  }
}

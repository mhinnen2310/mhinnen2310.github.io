import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { MAX_UPLOAD_BYTES, processImageUpload } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId } = await ctx.params;
  try {
    const form = await req.formData();
    const image = form.get("image") ?? form.get("file");
    if (!(image instanceof File) || !TYPES.has(image.type) || image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Gebruik een geldige afbeelding van maximaal 20 MB." }, { status: 400 });
    }
    const bike = await prisma.bike.findUnique({ where: { id: bikeId }, select: { id: true } });
    if (!bike) return NextResponse.json({ error: "Fiets niet gevonden." }, { status: 404 });
    const processed = await processImageUpload(Buffer.from(await image.arrayBuffer()), image.type, "battery-labels");
    await prisma.bike.update({ where: { id: bikeId }, data: { batteryLabelPhotoKey: processed.key } });
    await audit("bike.battery_label_added", "Bike", bikeId, null, actor);
    return NextResponse.json({ key: processed.key }, { status: 201 });
  } catch (error) {
    console.error("battery label upload failed", error);
    return NextResponse.json({ error: "Het acculabel kon niet worden verwerkt." }, { status: 500 });
  }
}

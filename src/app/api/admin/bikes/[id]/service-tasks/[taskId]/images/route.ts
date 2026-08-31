import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { MAX_UPLOAD_BYTES, processImageUpload } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id: bikeId, taskId } = await ctx.params;
  try {
    const form = await req.formData();
    const image = form.get("image") ?? form.get("file");
    if (!(image instanceof File) || !TYPES.has(image.type) || image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Gebruik een geldige afbeelding van maximaal 20 MB." }, { status: 400 });
    }
    const task = await prisma.serviceTask.findFirst({ where: { id: taskId, bikeId }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Werkplaatsregel niet gevonden." }, { status: 404 });
    const processed = await processImageUpload(Buffer.from(await image.arrayBuffer()), image.type, "workshop");
    await prisma.serviceTask.update({ where: { id: task.id }, data: { photoKeys: { push: processed.key } } });
    await audit("bike.service_task_photo_added", "Bike", bikeId, { taskId: task.id }, actor);
    return NextResponse.json({ key: processed.key }, { status: 201 });
  } catch (error) {
    console.error("workshop photo upload failed", error);
    return NextResponse.json({ error: "De werkplaatsfoto kon niet worden verwerkt." }, { status: 500 });
  }
}

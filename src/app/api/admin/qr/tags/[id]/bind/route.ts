import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bindQrTag, QrTagError } from "@/lib/qr-tags";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser(); if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  try {
    const body = await req.json() as { bikeId?: unknown; inventoryCode?: unknown };
    let bikeId = typeof body.bikeId === "string" ? body.bikeId : null;
    if (!bikeId && typeof body.inventoryCode === "string" && body.inventoryCode.trim()) bikeId = (await prisma.bike.findUnique({ where: { inventoryCode: body.inventoryCode.trim() }, select: { id: true } }))?.id ?? null;
    if (!bikeId) return NextResponse.json({ error: "Kies een bestaande fiets." }, { status: 400 });
    const { id } = await ctx.params; const tag = await bindQrTag(id, bikeId, actor); return NextResponse.json({ tag });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "Deze fiets heeft al een QR-tag." }, { status: 409 });
    if (error instanceof QrTagError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("QR bind failed", error); return NextResponse.json({ error: "QR-tag kon niet worden gekoppeld." }, { status: 500 });
  }
}

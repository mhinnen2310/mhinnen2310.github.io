import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { correctQrBinding, QrTagError } from "@/lib/qr-tags";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser(); if (!actor || !roleAtLeast(actor.role, "ADMIN")) return NextResponse.json({ error: "Alleen een beheerder mag een koppeling corrigeren." }, { status: 403 });
  try {
    const body = await req.json() as { inventoryCode?: unknown; reason?: unknown };
    if (typeof body.inventoryCode !== "string" || typeof body.reason !== "string") return NextResponse.json({ error: "Ongeldige correctie." }, { status: 400 });
    const bike = await prisma.bike.findUnique({ where: { inventoryCode: body.inventoryCode.trim() }, select: { id: true } });
    if (!bike) return NextResponse.json({ error: "Fiets niet gevonden." }, { status: 404 });
    const { id } = await ctx.params; await correctQrBinding(id, bike.id, body.reason, actor); return NextResponse.json({ ok: true });
  } catch (error) { if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "De doelfiets heeft al een QR-tag." }, { status: 409 }); if (error instanceof QrTagError) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ error: "Correctie kon niet worden verwerkt." }, { status: 500 }); }
}

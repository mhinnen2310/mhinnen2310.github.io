import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { retireQrTag, QrTagError } from "@/lib/qr-tags";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser(); if (!actor || !roleAtLeast(actor.role, "ADMIN")) return NextResponse.json({ error: "Alleen een beheerder mag een QR-tag intrekken." }, { status: 403 });
  try { const body = await req.json() as { reason?: unknown }; if (typeof body.reason !== "string") return NextResponse.json({ error: "Een reden is verplicht." }, { status: 400 }); const { id } = await ctx.params; await retireQrTag(id, body.reason, actor); return NextResponse.json({ ok: true }); } catch (error) { if (error instanceof QrTagError) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ error: "QR-tag kon niet worden ingetrokken." }, { status: 500 }); }
}

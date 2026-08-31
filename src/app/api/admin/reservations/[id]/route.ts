import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { BikeAdminError, unreserveBike } from "@/lib/bike-admin";
import { prisma } from "@/lib/prisma";

/** Explicitly releases manual/appointment holds; checkout holds remain lifecycle-owned. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: { action?: unknown; releaseTo?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (body.action !== "release" || (body.releaseTo !== "AVAILABLE" && body.releaseTo !== "READY")) {
    return NextResponse.json({ error: "Ongeldige reserveringsactie." }, { status: 400 });
  }
  const reservation = await prisma.reservation.findUnique({ where: { id }, select: { bikeId: true } });
  if (!reservation) return NextResponse.json({ error: "Reservering niet gevonden." }, { status: 404 });
  try {
    await unreserveBike(reservation.bikeId, actor, body.releaseTo, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BikeAdminError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin reservation release failed", error);
    return NextResponse.json({ error: "De reservering kon niet veilig worden vrijgegeven." }, { status: 500 });
  }
}

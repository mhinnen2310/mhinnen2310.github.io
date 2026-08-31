import { NextResponse } from "next/server";
import { BikeAdminError, unreserveBike } from "@/lib/bike-admin";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  const reservation = await prisma.reservation.findUnique({ where: { id }, select: { bikeId: true } });
  if (!reservation) return NextResponse.json({ error: "Reservering niet gevonden." }, { status: 404 });
  try { await unreserveBike(reservation.bikeId, actor, "AVAILABLE", id); return mobileOk({ ok: true }); }
  catch (error) { if (error instanceof BikeAdminError) return mobileError(error, "Vrijgeven mislukt."); console.error("mobile unreserve failed", error); return NextResponse.json({ error: "Vrijgeven mislukt." }, { status: 500 }); }
}

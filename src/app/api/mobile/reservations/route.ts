import { NextResponse } from "next/server";
import { BikeAdminError, reserveBike } from "@/lib/bike-admin";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const reservations = await prisma.reservation.findMany({ where: { status: "ACTIVE" }, orderBy: { expiresAt: "asc" }, take: 100, include: { bike: { select: { id: true, inventoryCode: true, title: true, status: true } }, order: { select: { orderNumber: true, paymentStatus: true } } } });
  return mobileOk({ reservations });
}

export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  const text = (key: string, max: number) => body[key] == null ? null : typeof body[key] === "string" && body[key].trim().length <= max ? body[key].trim() || null : undefined;
  const bikeId = typeof body.bikeId === "string" ? body.bikeId : null;
  const source = body.source === "APPOINTMENT" ? "APPOINTMENT" : body.source === "MANUAL" ? "MANUAL" : null;
  const expiresInMinutes = typeof body.expiresInMinutes === "number" && Number.isSafeInteger(body.expiresInMinutes) ? body.expiresInMinutes : undefined;
  const customerName = text("customerName", 200), customerEmail = text("customerEmail", 320), customerPhone = text("customerPhone", 80), note = text("note", 2000);
  if (!bikeId || !source || customerName === undefined || customerEmail === undefined || customerPhone === undefined || note === undefined) return NextResponse.json({ error: "Controleer de reserveringsgegevens." }, { status: 400 });
  try { await reserveBike(bikeId, { source, customerName, customerEmail, customerPhone, note, expiresInMinutes }, actor); return mobileOk({ ok: true }, 201); }
  catch (error) { if (error instanceof BikeAdminError) return mobileError(error, "Reserveren mislukt."); console.error("mobile reserve failed", error); return NextResponse.json({ error: "Reserveren mislukt." }, { status: 500 }); }
}

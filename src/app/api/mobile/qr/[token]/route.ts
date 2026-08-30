import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { bindQrTag, QrTagError } from "@/lib/qr-tags";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Resolve an opaque physical label without ever returning the label token. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  const { token } = await ctx.params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: "QR-code is ongeldig." }, { status: 400 });
  const tag = await prisma.qrTag.findUnique({
    where: { secureToken: token },
    select: { id: true, displayCode: true, status: true, bike: { select: { id: true, inventoryCode: true, title: true, status: true, priceCents: true } } },
  });
  if (!tag) return NextResponse.json({ error: "QR-code is niet bekend." }, { status: 404 });
  await audit("mobile.qr_resolved", "QrTag", tag.id, { displayCode: tag.displayCode, status: tag.status }, actor);
  return mobileOk({ tag: { id: tag.id, displayCode: tag.displayCode, status: tag.status }, bike: tag.bike });
}

/** A previously unused tag may be bound once, using the same domain operation as admin. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { actor, response } = await mobileActor(req);
  if (!actor) return response!;
  const { token } = await ctx.params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: "QR-code is ongeldig." }, { status: 400 });
  let body: { bikeId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (typeof body.bikeId !== "string" || !body.bikeId) return NextResponse.json({ error: "Fiets ontbreekt." }, { status: 400 });
  const tag = await prisma.qrTag.findUnique({ where: { secureToken: token }, select: { id: true, status: true } });
  if (!tag) return NextResponse.json({ error: "QR-code is niet bekend." }, { status: 404 });
  try {
    return mobileOk({ tag: await bindQrTag(tag.id, body.bikeId, actor) });
  } catch (error) {
    if (error instanceof QrTagError) return mobileError(error, "QR-code kon niet worden gekoppeld.");
    console.error("mobile QR bind failed", error);
    return NextResponse.json({ error: "QR-code kon niet worden gekoppeld." }, { status: 500 });
  }
}

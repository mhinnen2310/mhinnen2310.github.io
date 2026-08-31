import { NextResponse } from "next/server";
import { generateMarktplaatsListing } from "@/lib/marktplaats";
import { mobileActor, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

/** Copy-assist only: no third-party marketplace account is ever controlled by the app. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const { id } = await ctx.params;
  const bike = await prisma.bike.findUnique({ where: { id } });
  if (!bike) return NextResponse.json({ error: "Fiets niet gevonden." }, { status: 404 });
  return mobileOk({ listing: await generateMarktplaatsListing(bike), bike: { id: bike.id, inventoryCode: bike.inventoryCode, status: bike.status } });
}

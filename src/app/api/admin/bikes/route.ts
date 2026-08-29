import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { BikeInputError, parseBikeCreate, withInitialBikeLifecycle } from "@/lib/bike-input";
import { nextBikeInventoryCodeInTx } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Create one physical bike. Inventory code and initial INTAKE status are server-owned. */
export async function POST(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const data = parseBikeCreate(body);
    const requestedSlug = typeof data.slug === "string" ? data.slug : null;
    const bike = await prisma.$transaction(async (tx) => {
      const inventoryCode = await nextBikeInventoryCodeInTx(tx);
      const slug = slugify(requestedSlug ?? `${data.brand}-${data.model}-${inventoryCode}`);
      if (!slug) throw new BikeInputError("De slug is ongeldig.");
      return tx.bike.create({
        data: { ...(withInitialBikeLifecycle(data) as Prisma.BikeCreateInput), inventoryCode, slug, intakeRecord: { create: {} } },
        select: { id: true, inventoryCode: true },
      });
    });
    await audit("bike.created", "Bike", bike.id, { inventoryCode: bike.inventoryCode, status: "INTAKE" }, actor);
    return NextResponse.json(bike, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Deze slug bestaat al. Kies een andere titel of uitvoering." }, { status: 409 });
    }
    if (error instanceof BikeInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike create failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden aangemaakt." }, { status: 500 });
  }
}

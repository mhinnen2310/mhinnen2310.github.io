import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

function integer(value: unknown, label: string, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} is ongeldig.`);
  }
  return value;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const stockQuantity = integer(body.stockQuantity, "Voorraad", 1_000_000);
    const salePriceCents = integer(body.salePriceCents, "Verkoopprijs", 100_000_000);
    if (typeof body.active !== "boolean") throw new Error("Actief-status is ongeldig.");
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new Error("Product niet gevonden.");
      const updated = await tx.product.update({ where: { id }, data: { stockQuantity, salePriceCents, active: body.active as boolean } });
      const change = stockQuantity - current.stockQuantity;
      if (change !== 0) {
        await tx.stockMovement.create({ data: { productId: id, change, reason: "adjust", reference: "admin", note: "Handmatige voorraadcorrectie" } });
      }
      return updated;
    });
    await audit("product.updated", "Product", id, { stockQuantity, salePriceCents, active: body.active }, actor);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    if (error instanceof Error && /ongeldig|niet gevonden/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("admin product update failed", error);
    return NextResponse.json({ error: "Het product kon niet worden opgeslagen." }, { status: 500 });
  }
}

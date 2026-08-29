import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { ProductInputError, parseProductUpdate } from "@/lib/product-input";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

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
    const data = parseProductUpdate(body);
    if (typeof data.slug === "string") {
      const slug = slugify(data.slug);
      if (!slug) throw new ProductInputError("De slug is ongeldig.");
      data.slug = slug;
    }
    if (data.sku === null) throw new ProductInputError("SKU is verplicht.");
    if (data.title === null) throw new ProductInputError("Titel is verplicht.");
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new Error("Product niet gevonden.");
      const updated = await tx.product.update({ where: { id }, data });
      const requestedStock = typeof data.stockQuantity === "number" ? data.stockQuantity : current.stockQuantity;
      const change = requestedStock - current.stockQuantity;
      if (change !== 0) {
        await tx.stockMovement.create({ data: { productId: id, change, reason: "adjust", reference: "admin", note: "Handmatige voorraadcorrectie" } });
      }
      return updated;
    });
    await audit("product.updated", "Product", id, { fields: Object.keys(data) }, actor);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    if (error instanceof ProductInputError || (error instanceof Error && /ongeldig|niet gevonden/i.test(error.message))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("admin product update failed", error);
    return NextResponse.json({ error: "Het product kon niet worden opgeslagen." }, { status: 500 });
  }
}

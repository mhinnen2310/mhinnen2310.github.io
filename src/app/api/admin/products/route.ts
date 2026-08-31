import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { ProductInputError, parseProductCreate } from "@/lib/product-input";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Create a conventional stocked accessory, including its opening stock movement. */
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
    const data = parseProductCreate(body);
    const requestedSlug = typeof data.slug === "string" ? data.slug : null;
    const slug = slugify(requestedSlug ?? `${data.title}-${data.sku}`);
    if (!slug) throw new ProductInputError("De slug is ongeldig.");
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...(data as Prisma.ProductUncheckedCreateInput), slug }, select: { id: true, sku: true, stockQuantity: true } });
      if (created.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: { productId: created.id, change: created.stockQuantity, reason: "receive", reference: "admin-intake", note: "Openingsvoorraad via beheer" },
        });
      }
      return created;
    });
    await audit("product.created", "Product", product.id, { sku: product.sku, stockQuantity: product.stockQuantity }, actor);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Deze SKU of slug bestaat al." }, { status: 409 });
    if (error instanceof ProductInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin product create failed", error);
    return NextResponse.json({ error: "Het accessoire kon niet worden aangemaakt." }, { status: 500 });
  }
}

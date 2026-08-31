import { prisma } from "./prisma";
import type { Cart, CartLine, LineKind } from "@prisma/client";
import { randomToken } from "./utils";

/**
 * Server-side cart.
 *
 * Rules:
 * - UNIQUE_BIKE lines are always quantity 1 (Invariant 2)
 * - STOCK_ITEM lines have normal quantity rules
 * - Prices are NEVER stored in the cart; they are read from the DB at quote
 *   time, so client-side price tampering is impossible (Invariant 5)
 * - Every cart mutation re-validates availability server-side
 */

export class CartError extends Error {
  constructor(
    message: string,
    public code:
      | "BIKE_UNAVAILABLE"
      | "BIKE_RESERVED"
      | "BIKE_SOLD"
      | "PRODUCT_INACTIVE"
      | "OUT_OF_STOCK"
      | "INVALID_QTY"
      | "NOT_FOUND",
  ) {
    super(message);
    this.name = "CartError";
  }
}

export async function getOrCreateCart(token: string | null): Promise<Cart> {
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) return existing;
  }
  const t = randomToken(24);
  return prisma.cart.create({ data: { token: t } });
}

export async function getCartByToken(token: string | null | undefined): Promise<Cart | null> {
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token } });
}

export interface QuotedLine {
  id: string;
  kind: LineKind;
  refId: string; // bikeId or productId
  name: string;
  identifier: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  imageKey: string | null;
  available: boolean;
  issue: string | null;
}

export interface CartQuote {
  cartId: string;
  lines: QuotedLine[];
  subtotalCents: number;
  allValid: boolean;
  issues: string[];
}

export async function quoteCart(cartId: string): Promise<CartQuote> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      lines: {
        include: {
          bike: { include: { images: { where: { isInternal: false }, orderBy: { sortOrder: "asc" }, take: 1 } } },
          product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
        },
      },
    },
  });
  if (!cart) throw new CartError("Winkelwagen niet gevonden.", "NOT_FOUND");

  const lines: QuotedLine[] = [];
  const issues: string[] = [];
  let subtotal = 0;
  let allValid = true;

  for (const line of cart.lines) {
    if (line.kind === "UNIQUE_BIKE") {
      const bike = line.bike!;
      const available = bike.status === "AVAILABLE";
      const issue =
        bike.status === "SOLD" || bike.status === "ARCHIVED"
          ? "Deze fiets is niet meer beschikbaar."
          : !available
            ? "Deze fiets is momenteel gereserveerd of niet beschikbaar."
            : null;
      if (issue) {
        allValid = false;
        issues.push(issue);
      }
      lines.push({
        id: line.id,
        kind: "UNIQUE_BIKE",
        refId: bike.id,
        name: bike.title,
        identifier: bike.inventoryCode,
        unitPriceCents: bike.priceCents,
        quantity: 1, // invariant
        lineTotalCents: bike.priceCents,
        imageKey: bike.images[0]?.storageKey ?? null,
        available,
        issue,
      });
      subtotal += bike.priceCents;
    } else {
      const product = line.product!;
      const qty = Math.min(line.quantity, product.stockQuantity);
      const insufficient = line.quantity > product.stockQuantity;
      const inactive = !product.active;
      const available = product.active && product.stockQuantity >= line.quantity;
      if (!available) {
        allValid = false;
        issues.push(
          insufficient
            ? `Nog maar ${product.stockQuantity} op voorraad van ${product.title}.`
            : `${product.title} is momenteel niet te bestellen.`,
        );
      }
      lines.push({
        id: line.id,
        kind: "STOCK_ITEM",
        refId: product.id,
        name: product.title,
        identifier: product.sku,
        unitPriceCents: product.salePriceCents,
        quantity: available ? line.quantity : qty,
        lineTotalCents: available ? product.salePriceCents * line.quantity : 0,
        imageKey: product.images[0]?.storageKey ?? null,
        available,
        issue: null,
      });
      if (available) subtotal += product.salePriceCents * line.quantity;
    }
  }

  return { cartId: cart.id, lines, subtotalCents: subtotal, allValid, issues };
}

// --- Mutations ---------------------------------------------------------------

export async function addBikeToCart(cartId: string, bikeId: string): Promise<{ lineId: string }> {
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } });
  if (!bike) throw new CartError("Fiets niet gevonden.", "NOT_FOUND");
  if (bike.status === "SOLD" || bike.status === "ARCHIVED") {
    throw new CartError("Deze fiets is verkocht en niet te bestellen.", "BIKE_SOLD");
  }
  if (bike.status !== "AVAILABLE") {
    throw new CartError("Deze fiets is momenteel gereserveerd of niet beschikbaar.", "BIKE_RESERVED");
  }

  const existing = await prisma.cartLine.findFirst({ where: { cartId, bikeId } });
  if (existing) return { lineId: existing.id }; // already there, qty stays 1

  const line = await prisma.cartLine.create({
    data: { cartId, kind: "UNIQUE_BIKE", bikeId, quantity: 1 },
  });
  return { lineId: line.id };
}

export async function addProductToCart(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<{ lineId: string }> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new CartError("Ongeldige hoeveelheid.", "INVALID_QTY");
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new CartError("Product niet gevonden.", "NOT_FOUND");
  if (!product.active) throw new CartError("Dit product is momenteel niet te bestellen.", "PRODUCT_INACTIVE");
  if (product.stockQuantity < quantity) {
    throw new CartError(`Nog maar ${product.stockQuantity} op voorraad.`, "OUT_OF_STOCK");
  }

  const existing = await prisma.cartLine.findFirst({ where: { cartId, productId } });
  const newQty = (existing?.quantity ?? 0) + quantity;
  if (newQty > product.stockQuantity) {
    throw new CartError(`Nog maar ${product.stockQuantity} op voorraad.`, "OUT_OF_STOCK");
  }
  if (existing) {
    const line = await prisma.cartLine.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
    return { lineId: line.id };
  }
  const line = await prisma.cartLine.create({
    data: { cartId, kind: "STOCK_ITEM", productId, quantity },
  });
  return { lineId: line.id };
}

export async function setProductQuantity(cartId: string, lineId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError("Ongeldige hoeveelheid.", "INVALID_QTY");
  }
  const line = await prisma.cartLine.findUnique({ where: { id: lineId }, include: { product: true } });
  if (!line || line.cartId !== cartId) throw new CartError("Winkelwagengregel niet gevonden.", "NOT_FOUND");
  if (line.kind === "UNIQUE_BIKE") {
    // Invariant 2: a unique bike is never quantity-adjustable.
    throw new CartError("Voor een unieke fiets staat de hoeveelheid vast op 1.", "INVALID_QTY");
  }
  const product = line.product!;
  if (quantity > product.stockQuantity) {
    throw new CartError(`Nog maar ${product.stockQuantity} op voorraad.`, "OUT_OF_STOCK");
  }
  await prisma.cartLine.update({ where: { id: line.id }, data: { quantity } });
}

export async function removeLine(cartId: string, lineId: string) {
  const line = await prisma.cartLine.findUnique({ where: { id: lineId } });
  if (!line || line.cartId !== cartId) return;
  await prisma.cartLine.delete({ where: { id: line.id } });
}

export async function clearCart(cartId: string) {
  await prisma.cartLine.deleteMany({ where: { cartId } });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCartByToken, quoteCart } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-session";

/**
 * Authoritative cart quote (prices from DB, never from the client).
 * Used by the header badge and the /winkelwagen page.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const cart = await getCartByToken(token);
  if (!cart) {
    return NextResponse.json({ lines: [], subtotalCents: 0, allValid: true, issues: [] });
  }
  const quote = await quoteCart(cart.id);
  return NextResponse.json({
    lines: quote.lines,
    subtotalCents: quote.subtotalCents,
    allValid: quote.allValid,
    issues: quote.issues,
  });
}

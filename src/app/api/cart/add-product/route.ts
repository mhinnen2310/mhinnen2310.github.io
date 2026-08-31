import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateCart, getCartByToken, addProductToCart, CartError } from "@/lib/cart";
import { CART_COOKIE, CART_COOKIE_OPTIONS } from "@/lib/cart-session";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: Request) {
  let body: { productId?: unknown; quantity?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.productId !== "string" || !body.productId) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const quantity = typeof body.quantity === "number" ? body.quantity : 1;

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const existingCart = token ? await getCartByToken(token) : null;
  const cart = existingCart ?? (await getOrCreateCart(token));
  if (!existingCart) store.set(CART_COOKIE, cart.token, CART_COOKIE_OPTIONS);

  try {
    const { lineId } = await addProductToCart(cart.id, body.productId, quantity);
    await trackEvent("add_to_cart", "product", body.productId, { quantity });
    return NextResponse.json({ ok: true, lineId });
  } catch (err) {
    const message = err instanceof CartError ? err.message : "Er ging iets mis. Probeer het opnieuw.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

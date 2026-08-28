import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateCart, getCartByToken, addBikeToCart, CartError } from "@/lib/cart";
import { CART_COOKIE, CART_COOKIE_OPTIONS } from "@/lib/cart-session";
import { trackEvent } from "@/lib/analytics";

function jsonError(err: unknown): NextResponse {
  const message =
    err instanceof CartError
      ? err.message
      : "Er ging iets mis. Probeer het opnieuw.";
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Add a UNIQUE bike to the cart. Quantity is always 1 (Invariant 2).
 * The server re-validates availability on every call.
 */
export async function POST(req: Request) {
  let body: { bikeId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.bikeId !== "string" || !body.bikeId) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const existingCart = token ? await getCartByToken(token) : null;
  const cart = existingCart ?? (await getOrCreateCart(token));
  if (!existingCart) store.set(CART_COOKIE, cart.token, CART_COOKIE_OPTIONS);

  try {
    const { lineId } = await addBikeToCart(cart.id, body.bikeId);
    await trackEvent("add_to_cart", "bike", body.bikeId);
    return NextResponse.json({ ok: true, lineId });
  } catch (err) {
    return jsonError(err);
  }
}

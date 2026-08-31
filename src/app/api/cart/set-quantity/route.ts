import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCartByToken, setProductQuantity, CartError } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-session";

/**
 * Set the quantity of a STOCK_ITEM line. UNIQUE_BIKE lines always reject
 * (Invariant 2) — the error is returned as a user-facing message.
 */
export async function POST(req: Request) {
  let body: { lineId?: unknown; quantity?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.lineId !== "string" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const cart = await getCartByToken(token);
  if (!cart) return NextResponse.json({ error: "Winkelwagen niet gevonden." }, { status: 400 });

  try {
    await setProductQuantity(cart.id, body.lineId, Math.trunc(body.quantity));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof CartError ? err.message : "Er ging iets mis. Probeer het opnieuw.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

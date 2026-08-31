import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCartByToken, removeLine } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-session";

export async function POST(req: Request) {
  let body: { lineId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.lineId !== "string") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const cart = await getCartByToken(token);
  if (!cart) return NextResponse.json({ error: "Winkelwagen niet gevonden." }, { status: 400 });

  await removeLine(cart.id, body.lineId);
  return NextResponse.json({ ok: true });
}

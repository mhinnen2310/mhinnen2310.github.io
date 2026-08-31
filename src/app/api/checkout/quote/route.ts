import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { quoteCheckout } from "@/lib/checkout-quote";
import { CART_COOKIE } from "@/lib/cart-session";

/** Server-side checkout quote for the /checkout page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const view = await quoteCheckout(token, url.searchParams.get("method"));
  if (!view) {
    return NextResponse.json({ empty: true }, { status: 200 });
  }
  return NextResponse.json(view, {
    headers: { "cache-control": "no-store" },
  });
}

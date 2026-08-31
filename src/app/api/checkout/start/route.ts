import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCheckout, CheckoutError } from "@/lib/checkout";
import { getSessionUser } from "@/lib/auth";
import { CART_COOKIE } from "@/lib/cart-session";
import { trackEvent } from "@/lib/analytics";

/**
 * Start checkout: validates the cart, quotes everything server-side and
 * atomically reserves any unique bike (Invariant 3). The client is only
 * ever told the payment URL — never the prices it may rely on.
 */
export async function POST(req: Request) {
  let body: {
    customer?: { name?: unknown; email?: unknown; phone?: unknown; company?: unknown };
    billing?: { line1?: unknown; line2?: unknown; city?: unknown; postcode?: unknown; country?: unknown };
    delivery?: { methodId?: unknown; line1?: unknown; line2?: unknown; city?: unknown; postcode?: unknown; country?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  const name = str(body.customer?.name) ?? "";
  const email = str(body.customer?.email) ?? "";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (name.length < 2) return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  if (!str(body.delivery?.methodId)) return NextResponse.json({ error: "Kies een leveringsmethode." }, { status: 400 });

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const user = await getSessionUser();

  try {
    const result = await createCheckout({
      cartToken: token ?? "",
      customer: {
        name,
        email,
        phone: str(body.customer?.phone),
        company: str(body.customer?.company),
      },
      billing: {
        line1: str(body.billing?.line1),
        line2: str(body.billing?.line2),
        city: str(body.billing?.city),
        postcode: str(body.billing?.postcode),
        country: str(body.billing?.country) ?? "NL",
      },
      delivery: {
        methodId: str(body.delivery?.methodId) ?? "",
        line1: str(body.delivery?.line1),
        line2: str(body.delivery?.line2),
        city: str(body.delivery?.city),
        postcode: str(body.delivery?.postcode),
        country: str(body.delivery?.country) ?? "NL",
      },
      userId: user?.id ?? null,
    });

    await trackEvent("checkout_created", "order", result.orderNumber);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("checkout start failed", err);
    return NextResponse.json({ error: "De bestelling kon niet worden verwerkt. Probeer het opnieuw." }, { status: 500 });
  }
}

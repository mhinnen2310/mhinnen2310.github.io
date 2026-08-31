import { NextResponse } from "next/server";
import { subscribeNewsletter, FormError } from "@/lib/forms";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const { created } = await subscribeNewsletter(req.headers, body.email, "website");
    if (created) {
      await trackEvent("newsletter_subscribed", "email", String(body.email));
    }
    return NextResponse.json(
      { ok: true, message: "Je staat op de nieuwsbrief. Je kunt je op elk moment afmelden met de link in de e-mail." },
      { status: created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof FormError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    console.error("newsletter failed", err);
    return NextResponse.json({ error: "Er ging iets mis. Probeer het later opnieuw." }, { status: 500 });
  }
}

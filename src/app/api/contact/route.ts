import { NextResponse } from "next/server";
import { createContactMessage, FormError, type ContactInput } from "@/lib/forms";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    await createContactMessage(req.headers, body as unknown as ContactInput);
    return NextResponse.json(
      { ok: true, message: "Je bericht is verstuurd. We reageren meestal binnen één werkdag." },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof FormError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    console.error("contact failed", err);
    return NextResponse.json({ error: "Er ging iets mis. Probeer het over enkele minuten opnieuw." }, { status: 500 });
  }
}

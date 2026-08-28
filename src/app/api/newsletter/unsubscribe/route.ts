import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/forms";

export async function POST(req: Request) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.token !== "string") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const ok = await unsubscribeByToken(body.token);
  if (!ok) {
    return NextResponse.json({ error: "Deze afmeldlink is ongeldig of verlopen." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    message: "Je bent afgemeld voor de nieuwsbrief. Tot snel.",
  });
}

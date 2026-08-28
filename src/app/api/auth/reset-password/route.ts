import { NextResponse } from "next/server";
import { resetPasswordWithToken, AccountError } from "@/lib/account";

export async function POST(req: Request) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ error: "Ongeldige hersteltoken." }, { status: 400 });
  }
  try {
    const ok = await resetPasswordWithToken(body.token, body.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Deze hersteltoken is ongeldig of verlopen. Vraag een nieuwe link aan." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    return NextResponse.json({ error: "Er ging iets mis. Probeer het opnieuw." }, { status: 500 });
  }
}

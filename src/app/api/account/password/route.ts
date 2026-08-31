import { NextResponse } from "next/server";
import { changePassword, AccountError } from "@/lib/account";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Ingelogd zijn vereist." }, { status: 401 });
  }
  let body: { current?: unknown; next?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  try {
    await changePassword(user.id, body.current, body.next);
    return NextResponse.json({ ok: true, message: "Je wachtwoord is gewijzigd." });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    return NextResponse.json({ error: "Er ging iets mis. Probeer het opnieuw." }, { status: 500 });
  }
}

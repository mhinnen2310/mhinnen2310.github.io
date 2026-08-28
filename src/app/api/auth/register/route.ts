import { NextResponse } from "next/server";
import { registerUser, AccountError } from "@/lib/account";
import { ipHashOf } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    await registerUser({ name: body.name, email: body.email, password: body.password }, await ipHashOf(req.headers));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    console.error("register failed", err);
    return NextResponse.json({ error: "Er ging iets mis. Probeer het opnieuw." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAppointment, FormError, type AppointmentInput } from "@/lib/forms";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const result = await createAppointment(req.headers, body as unknown as AppointmentInput);
    return NextResponse.json(
      { ok: true, code: result.code, message: "Je aanvraag is ontvangen. We nemen binnen één werkdag contact met je op." },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof FormError) {
      return NextResponse.json({ error: err.message, field: err.field ?? undefined }, { status: 400 });
    }
    console.error("appointment failed", err);
    return NextResponse.json({ error: "Er ging iets mis. Probeer het over enkele minuten opnieuw." }, { status: 500 });
  }
}

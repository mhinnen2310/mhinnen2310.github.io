import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { createBikeDossier } from "@/lib/bike-admin";
import { BikeInputError } from "@/lib/bike-input";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Create one physical bike. Inventory code and initial INTAKE status are server-owned. */
export async function POST(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const bike = await createBikeDossier(body, actor);
    return NextResponse.json(bike, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Deze slug bestaat al. Kies een andere titel of uitvoering." }, { status: 409 });
    }
    if (error instanceof BikeInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike create failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden aangemaakt." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

function text(value: unknown, label: string, maxLength: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new Error(`${label} is verplicht.`);
    return null;
  }
  const result = value.trim();
  if (!result) {
    if (required) throw new Error(`${label} is verplicht.`);
    return null;
  }
  if (result.length > maxLength) throw new Error(`${label} is te lang.`);
  return result;
}

function cents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new Error("De vraagprijs is ongeldig.");
  }
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Create a physical, unique bike. It intentionally starts in INTAKE. */
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
    const inventoryCode = text(body.inventoryCode, "Voorraadcode", 50, true)!;
    const title = text(body.title, "Titel", 160, true)!;
    const brand = text(body.brand, "Merk", 100, true)!;
    const model = text(body.model, "Model", 120, true)!;
    const requestedSlug = text(body.slug, "Slug", 160);
    const slug = slugify(requestedSlug ?? `${brand}-${model}-${inventoryCode}`);
    if (!slug) throw new Error("De slug is ongeldig.");
    const description = text(body.description, "Beschrijving", 12_000);

    const bike = await prisma.bike.create({
      data: {
        inventoryCode,
        slug,
        title,
        brand,
        model,
        priceCents: cents(body.priceCents),
        bikeType: text(body.bikeType, "Fietstype", 80),
        colour: text(body.colour, "Kleur", 80),
        conditionGrade: text(body.conditionGrade, "Conditie", 80),
        description,
        descriptionTouched: Boolean(description),
        status: "INTAKE",
      },
      select: { id: true },
    });
    await audit("bike.created", "Bike", bike.id, { inventoryCode }, actor);
    return NextResponse.json({ id: bike.id }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Deze voorraadcode of slug bestaat al." }, { status: 409 });
    }
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike create failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden aangemaakt." }, { status: 500 });
  }
}

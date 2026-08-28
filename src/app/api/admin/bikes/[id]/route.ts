import type { BikeStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { BikeAdminError, setBikeStatus, updateBike } from "@/lib/bike-admin";
import { BIKE_STATUSES } from "@/lib/bikes";
import { slugify } from "@/lib/utils";

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new BikeAdminError(`${label} is verplicht.`);
  const result = value.trim();
  if (result.length > maxLength) throw new BikeAdminError(`${label} is te lang.`);
  return result;
}

function nullableText(value: unknown, label: string, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  if (result.length > maxLength) throw new BikeAdminError(`${label} is te lang.`);
  return result || null;
}

function validCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new BikeAdminError("De vraagprijs is ongeldig.");
  }
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    if (body.action === "status") {
      const status = body.status;
      if (typeof status !== "string" || !BIKE_STATUSES.includes(status as BikeStatus)) {
        throw new BikeAdminError("De gekozen status is ongeldig.");
      }
      const bike = await setBikeStatus(id, status as BikeStatus, actor);
      return NextResponse.json({ status: bike.status });
    }

    if (body.action !== "update") throw new BikeAdminError("Onbekende beheeractie.");
    const requestedSlug = requiredText(body.slug, "Slug", 160);
    const slug = slugify(requestedSlug);
    if (!slug) throw new BikeAdminError("De slug is ongeldig.");
    await updateBike(
      id,
      {
        title: requiredText(body.title, "Titel", 160),
        brand: requiredText(body.brand, "Merk", 100),
        model: requiredText(body.model, "Model", 120),
        slug,
        priceCents: validCents(body.priceCents),
        bikeType: nullableText(body.bikeType, "Fietstype", 80),
        colour: nullableText(body.colour, "Kleur", 80),
        conditionGrade: nullableText(body.conditionGrade, "Conditie", 80),
        conditionDescription: nullableText(body.conditionDescription, "Conditiebeschrijving", 2_000),
        repairSummary: nullableText(body.repairSummary, "Reparatiesamenvatting", 2_000),
        description: nullableText(body.description, "Beschrijving", 12_000),
        descriptionTouched: true,
      },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Deze voorraadcode of slug bestaat al." }, { status: 409 });
    }
    if (error instanceof BikeAdminError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike update failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden bijgewerkt." }, { status: 500 });
  }
}

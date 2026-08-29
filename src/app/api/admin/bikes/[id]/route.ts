import type { BikeStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { BikeAdminError, setBikeStatus, updateBike } from "@/lib/bike-admin";
import { BikeInputError, parseBikeUpdate } from "@/lib/bike-input";
import { BIKE_STATUSES } from "@/lib/bikes";
import { slugify } from "@/lib/utils";

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
    const data = parseBikeUpdate(body);
    if (typeof data.slug === "string") {
      const slug = slugify(data.slug);
      if (!slug) throw new BikeInputError("De slug is ongeldig.");
      data.slug = slug;
    }
    for (const key of ["title", "brand", "model"] as const) {
      if (data[key] === null) throw new BikeInputError(`${key === "title" ? "Titel" : key === "brand" ? "Merk" : "Model"} is verplicht.`);
    }
    if (data.isElectric === null) throw new BikeInputError("Elektrisch is verplicht.");
    await updateBike(
      id,
      data,
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Deze voorraadcode of slug bestaat al." }, { status: 409 });
    }
    if (error instanceof BikeAdminError || error instanceof BikeInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("admin bike update failed", error);
    return NextResponse.json({ error: "De fiets kon niet worden bijgewerkt." }, { status: 500 });
  }
}

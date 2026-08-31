import { NextResponse } from "next/server";
import { mobileActor, mobileError, mobileOk } from "@/lib/mobile-route";
import { StaffSaleError, startStaffSale } from "@/lib/staff-sales";

export async function POST(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  let body: { bikeIds?: unknown; customerName?: unknown; customerEmail?: unknown; customerPhone?: unknown; customerCompany?: unknown; internalNotes?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 }); }
  if (!Array.isArray(body.bikeIds) || body.bikeIds.some((id) => typeof id !== "string") || typeof body.customerName !== "string" || typeof body.customerEmail !== "string") return NextResponse.json({ error: "Ongeldige verkoopgegevens." }, { status: 400 });
  const optional = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() || null : value == null ? null : undefined;
  const customerPhone = optional(body.customerPhone, 80), customerCompany = optional(body.customerCompany, 160), internalNotes = optional(body.internalNotes, 4_000);
  if (customerPhone === undefined || customerCompany === undefined || internalNotes === undefined) return NextResponse.json({ error: "Een verkoopveld is te lang of ongeldig." }, { status: 400 });
  try {
    return mobileOk({ order: await startStaffSale({ bikeIds: body.bikeIds, customerName: body.customerName, customerEmail: body.customerEmail, customerPhone, customerCompany, internalNotes }, actor) }, 201);
  } catch (error) {
    if (error instanceof StaffSaleError) return mobileError(error, "Verkoop kon niet worden gestart.");
    console.error("mobile sale start failed", error); return NextResponse.json({ error: "Verkoop kon niet worden gestart." }, { status: 500 });
  }
}

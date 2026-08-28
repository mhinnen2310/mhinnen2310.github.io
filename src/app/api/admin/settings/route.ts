import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { updateSettings } from "@/lib/settings";

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is verplicht.`);
  if (value.trim().length > max) throw new Error(`${label} is te lang.`);
  return value.trim();
}

function optionalText(value: unknown, label: string, max: number): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.trim().length > max) throw new Error(`${label} is te lang.`);
  return value.trim();
}

export async function PATCH(req: Request) {
  const actor = await getStaffUser();
  if (!actor) return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  try {
    const email = optionalText(body.email, "E-mail", 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail is ongeldig.");
    await updateSettings({
      companyName: requiredText(body.companyName, "Bedrijfsnaam", 160),
      email,
      phone: optionalText(body.phone, "Telefoon", 50),
      addressLine: optionalText(body.addressLine, "Adres", 160),
      postcode: optionalText(body.postcode, "Postcode", 20),
      city: optionalText(body.city, "Plaats", 100),
      kvkNumber: optionalText(body.kvkNumber, "KvK-nummer", 40),
      vatId: optionalText(body.vatId, "Btw-id", 40),
      iban: optionalText(body.iban, "IBAN", 50),
      aboutText: optionalText(body.aboutText, "Over-ons-tekst", 20_000),
      newsletterEnabled: body.newsletterEnabled === true,
    });
    await audit("settings.updated", "SiteSettings", "1", { fields: Object.keys(body) }, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Instellingen opslaan is niet gelukt." }, { status: 500 });
  }
}

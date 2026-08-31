import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin-auth";
import { roleAtLeast } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { updateSettings } from "@/lib/settings";

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is verplicht.`);
  if (value.trim().length > max) throw new Error(`${label} is te lang.`);
  return value.trim();
}

function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.trim().length > max) throw new Error(`${label} is te lang.`);
  return value.trim();
}

export async function PATCH(req: Request) {
  const actor = await getStaffUser();
  if (!actor)
    return NextResponse.json({ error: "Niet geautoriseerd." }, { status: 401 });
  if (!roleAtLeast(actor.role, "ADMIN"))
    return NextResponse.json(
      { error: "Alleen een beheerder mag website-instellingen wijzigen." },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  try {
    const email = optionalText(body.email, "E-mail", 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("E-mail is ongeldig.");
    const openingHours =
      "openingHoursText" in body
        ? typeof body.openingHoursText === "string"
          ? body.openingHoursText
              .split(/\r?\n/)
              .map((line) => {
                const [days, ...hours] = line.split("|");
                return {
                  days: (days ?? "").trim(),
                  hours: hours.join("|").trim(),
                };
              })
              .filter((item) => item.days && item.hours)
              .slice(0, 14)
          : []
        : undefined;
    const homepage =
      "heroTitle" in body || "heroSubtitle" in body || "homepageIntro" in body || "primaryCta" in body || "secondaryCta" in body || "showRecentlyAdded" in body || "showWhyUs" in body || "showHowItWorks" in body
        ? {
            heroTitle: optionalText(body.heroTitle, "Hero-titel", 240),
            heroSubtitle: optionalText(body.heroSubtitle, "Hero-subtitel", 500),
            intro: optionalText(body.homepageIntro, "Homepage-intro", 5_000),
            primaryCta: optionalText(body.primaryCta, "Primaire CTA", 100),
            secondaryCta: optionalText(
              body.secondaryCta,
              "Secundaire CTA",
              100,
            ),
            showRecentlyAdded: body.showRecentlyAdded !== false,
            showWhyUs: body.showWhyUs !== false,
            showHowItWorks: body.showHowItWorks !== false,
          }
        : undefined;
    const announcement =
      "announcementText" in body || "announcementEnabled" in body
        ? {
            enabled: body.announcementEnabled === true,
            text:
              typeof body.announcementText === "string"
                ? body.announcementText.trim().slice(0, 1_000)
                : "",
            link:
              typeof body.announcementLink === "string" &&
              body.announcementLink.startsWith("/")
                ? body.announcementLink.trim()
                : null,
            startAt:
              typeof body.announcementStartAt === "string" &&
              !Number.isNaN(Date.parse(body.announcementStartAt))
                ? body.announcementStartAt
                : null,
            endAt:
              typeof body.announcementEndAt === "string" &&
              !Number.isNaN(Date.parse(body.announcementEndAt))
                ? body.announcementEndAt
                : null,
          }
        : undefined;
    if (
      announcement?.startAt &&
      announcement.endAt &&
      Date.parse(announcement.startAt) > Date.parse(announcement.endAt)
    )
      throw new Error(
        "Startdatum van de melding moet vóór de einddatum liggen.",
      );
    const delivery =
      "deliveryTitle" in body ||
      "deliveryDescription" in body ||
      "deliveryOptions" in body
        ? {
            title: optionalText(body.deliveryTitle, "Bezorgingstitel", 160),
            description: optionalText(
              body.deliveryDescription,
              "Bezorginguitleg",
              5_000,
            ),
            options:
              typeof body.deliveryOptions === "string"
                ? body.deliveryOptions
                    .split(/\r?\n/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 12)
                : [],
          }
        : undefined;
    const warranty =
      "warrantyTitle" in body || "warrantyDescription" in body
        ? {
            title: optionalText(body.warrantyTitle, "Garantietitel", 160),
            publicNote: optionalText(
              body.warrantyDescription,
              "Garantie-uitleg",
              5_000,
            ),
          }
        : undefined;
    const tax =
      "taxBasis" in body || "bikeScheme" in body || "bikeRate" in body || "accessoryRate" in body
        ? {
            basis: body.taxBasis === "excl" ? "excl" : "incl",
            bikeScheme: body.bikeScheme === "STANDARD" ? "STANDARD" : "MARGIN",
            bikeRate: Number.isFinite(Number(body.bikeRate)) ? Math.min(100, Math.max(0, Number(body.bikeRate))) : 21,
            accessoryRate: Number.isFinite(Number(body.accessoryRate)) ? Math.min(100, Math.max(0, Number(body.accessoryRate))) : 21,
            requiresReview: body.taxRequiresReview !== false,
          }
        : undefined;
    if (tax?.bikeScheme === "MARGIN" && tax.basis !== "incl") {
      throw new Error("De margeregeling vereist verkoopprijzen inclusief btw.");
    }
    await updateSettings(
      {
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
        openingHours,
        homepage,
        announcement,
        delivery,
        warranty,
        tax,
      },
      actor.id,
    );
    await audit(
      "settings.updated",
      "SiteSettings",
      "1",
      { fields: Object.keys(body) },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(
      { error: "Instellingen opslaan is niet gelukt." },
      { status: 500 },
    );
  }
}

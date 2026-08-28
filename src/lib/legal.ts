import { prisma } from "./prisma";

/**
 * Legal pages (spec 4, 38).
 *
 * Text lives in the LegalPage table (editable in Admin) — never in source
 * code. Until a lawyer has reviewed the content the pages render honest
 * placeholders; nothing here is presented as final legal advice.
 */

export interface LegalPageView {
  slug: string;
  title: string;
  body: string;
  updatedAt: Date;
}

/**
 * Fallback placeholders used ONLY while no row exists in the database.
 * They are deliberately honest: they do not invent policy details.
 */
const FALLBACKS: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacyverklaring",
    body: [
      "Demi Fietsen verwerkt persoonsgegevens (zoals naam, e-mailadres en bestelgegevens) uitsluitend voor de uitvoering van je bestelling, het in stand houden van je account, garantie- en serviceafhandeling en — met jouw toestemming — de nieuwsbrief.",
      "Wij delen geen persoonsgegevens met derden, tenzij dit wettelijk verplicht is of nodig is voor de uitvoering van je bestelling (bijvoorbeeld transport of betaling).",
      "Je hebt te allen tijde recht op inzage, correctie en verwijdering van je persoonsgegevens. Neem hiervoor contact met ons op.",
      "",
      "LET OP: dit is nog geen definitieve tekst. Demi Fietsen brengt een volledige, door een juridisch professional gecontroleerde privacyverklaring aan plaats bij de livegang van de nieuwe website.",
    ].join("\n\n"),
  },
  "algemene-voorwaarden": {
    title: "Algemene voorwaarden",
    body: [
      "Deze pagina bevat nog geen definitieve algemene voorwaarden. Demi Fietsen werkt aan volledige voorwaarden (bestelling, betaling, levering, garantie, retour en klachten) die voorafgaand aan de livegang door een juridisch professional worden gecontroleerd.",
      "Tot die tijd gelden de wettelijke bepalingen op consumentenovereenkomsten. Voor vragen kun je altijd contact met ons opnemen.",
    ].join("\n\n"),
  },
  retourbeleid: {
    title: "Retour- en garantiebeleid",
    body: [
      "Op tweedehands fietsen die bij Demi Fietsen worden gekocht zit garantie; de exacte omvang (fiets, accu, elektrisch systeem) wordt bij elke verkoop vastgelegd en staat vermeld bij de betreffende fiets of bestelling.",
      "Retourneer- en garantieaanspraken worden per geval beoordeeld. Dien een verzoek in via het formulier ‘Retour, garantie & service’ en we nemen contact met je op.",
      "",
      "LET OP: dit is nog geen definitieve tekst. Demi Fietsen publiceert een volledige, door een juridisch professional gecontroleerde tekst voorafgaand aan de livegang van de nieuwe website.",
    ].join("\n\n"),
  },
  cookiebeleid: {
    title: "Cookiebeleid",
    body: [
      "Demi Fietsen gebruikt uitsluitend functionele cookies die nodig zijn om de winkelwagen en je inlogsessie te laten werken. Er worden geen trackingcookies zonder toestemming geplaatst.",
    ].join("\n\n"),
  },
};

export const LEGAL_SLUGS = Object.keys(FALLBACKS);

export async function getLegalPage(slug: string): Promise<LegalPageView | null> {
  const row = await prisma.legalPage.findUnique({ where: { slug } });
  if (row && row.body.trim()) {
    return { slug: row.slug, title: row.title, body: row.body, updatedAt: row.updatedAt };
  }
  const fallback = FALLBACKS[slug];
  if (!fallback) return null;
  return {
    slug,
    title: fallback.title,
    body: fallback.body,
    updatedAt: new Date(0),
  };
}

import { prisma } from "./prisma";
import type { Bike } from "@prisma/client";
import { formatPrice, numericValue } from "./utils";
import { FEATURE_CATALOG } from "./bikes";

/**
 * Marktplaats Listing Assistant (spec 27).
 *
 * Demi Fietsen also lists bikes on Marktplaats. We do NOT scrape or
 * auto-post (that would violate platform rules). Instead we generate a
 * ready-to-copy title + description from the SAME structured data, using
 * admin-editable templates (SiteSettings.marketplace).
 *
 * The internal bike record is the source of truth — never the marketplace.
 *
 * Architecture note: the `MarketplaceProvider` interface below is the
 * extension point for an official marketplace API integration in the
 * future (push/pull listing state) — copy-assist only for now.
 */

export interface MarketplaceTemplate {
  titleTemplate: string;
  descriptionTemplate: string;
}

export const DEFAULT_MARKTPLAATS_TEMPLATE: MarketplaceTemplate = {
  titleTemplate: "{{brand}} {{model}} — tweedehands e-bike, framemaat {{frameSize}}",
  descriptionTemplate:
    "{{model}} te koop bij Demi Fietsen.\n\n" +
    "Prijs: {{price}}\n" +
    "{{conditionLine}}{{batteryLine}}{{rangeLine}}{{specLine}}{{featuresLine}}\n" +
    "Deze fiets is uniek: je koopt precies het exemplaar op de foto's.\n" +
    "Bekijk alle details en plan een proefrit op demifietsen.nl.",
};

export interface MarketplaceProvider {
  readonly id: string;
  generateTitle(bike: Bike): string;
  generateDescription(bike: Bike): string;
}

async function getTemplate(): Promise<MarketplaceTemplate> {
  const s = await prisma.siteSettings.findFirst();
  const raw = (s?.marketplace ?? {}) as Record<string, unknown>;
  return {
    titleTemplate: typeof raw.titleTemplate === "string" && raw.titleTemplate.trim() ? raw.titleTemplate : DEFAULT_MARKTPLAATS_TEMPLATE.titleTemplate,
    descriptionTemplate:
      typeof raw.descriptionTemplate === "string" && raw.descriptionTemplate.trim()
        ? raw.descriptionTemplate
        : DEFAULT_MARKTPLAATS_TEMPLATE.descriptionTemplate,
  };
}

export interface MarketplaceListing {
  title: string;
  description: string;
  priceCents: number;
  condition: string | null;
}

export async function generateMarktplaatsListing(bike: Bike): Promise<MarketplaceListing> {
  const t = await getTemplate();
  const vars: Record<string, string> = buildVars(bike);
  return {
    title: render(t.titleTemplate, vars),
    description: render(t.descriptionTemplate, vars),
    priceCents: bike.priceCents,
    condition: bike.conditionGrade ?? null,
  };
}

function buildVars(bike: Bike): Record<string, string> {
  const b = bike as unknown as Record<string, unknown>;
  const str = (k: string): string => {
    const v = b[k];
    return typeof v === "string" && v.trim() ? v : "";
  };
  const num = (k: string): string => {
    const value = numericValue(b[k]);
    return value == null ? "" : String(value);
  };

  const batteryBits: string[] = [];
  if (num("batteryVoltage")) batteryBits.push(`${num("batteryVoltage")}V`);
  if (num("batteryAh")) batteryBits.push(`${num("batteryAh")} Ah`);
  if (num("batteryWh")) batteryBits.push(`${num("batteryWh")} Wh`);
  if (b.batteryReconditioned === true) batteryBits.push("gereviseerd");
  const battery = batteryBits.length ? `Accu: ${batteryBits.join(" ")}` : "";

  const range =
    num("rangeMinKm") && num("rangeMaxKm")
      ? `Verwachte actieradius: ca. ${num("rangeMinKm")}–${num("rangeMaxKm")} km`
      : num("rangeMaxKm")
        ? `Verwachte actieradius: ca. ${num("rangeMaxKm")} km`
        : "";

  const specBits: string[] = [];
  const frameSize = num("frameSizeCm");
  if (frameSize) specBits.push(`Framemaat ${frameSize} cm`);
  if (num("wheelSizeInches")) specBits.push(`${num("wheelSizeInches")} inch`);
  if (num("gears")) specBits.push(`${num("gears")} versnellingen`);
  if (num("assistanceLevels")) specBits.push(`${num("assistanceLevels")} ondersteuningsniveaus`);
  if (str("motorPosition")) specBits.push(`motor in de ${str("motorPosition")}`);
  const specLine = specBits.length ? specBits.join(", ") : "";

  const features = (Array.isArray(bike.features) ? bike.features : [])
    .map((f) => FEATURE_CATALOG[f] ?? f)
    .join(", ");

  const condition = b.conditionGrade ? `Staat: ${String(b.conditionGrade)}` : "";

  return {
    brand: str("brand"),
    model: str("model"),
    inventoryCode: bike.inventoryCode,
    price: formatPrice(bike.priceCents),
    frameSize,
    colour: str("colour"),
    gears: num("gears"),
    motorPosition: str("motorPosition"),
    condition,
    conditionLine: condition ? `${condition}\n` : "",
    battery,
    batteryLine: battery ? `${battery}\n` : "",
    range,
    rangeLine: range ? `${range}\n` : "",
    specLine: specLine ? `${specLine}\n` : "",
    featuresLine: features ? `Inclusief: ${features}\n` : "",
  };
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : v;
  });
}

export function validateMarketplaceTemplate(tpl: string): string[] {
  // Return unknown placeholders so the admin can fix the template.
  const allowed = new Set([
    "brand", "model", "inventoryCode", "price", "frameSize", "colour", "gears",
    "motorPosition", "condition", "conditionLine", "battery", "batteryLine",
    "range", "rangeLine", "specLine", "featuresLine",
  ]);
  const found = new Set<string>();
  for (const m of tpl.matchAll(/\{\{(\w+)\}\}/g)) {
    found.add(m[1] ?? "");
  }
  return [...found].filter((k) => !allowed.has(k));
}

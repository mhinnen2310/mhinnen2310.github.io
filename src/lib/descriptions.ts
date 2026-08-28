import type { Bike } from "@prisma/client";
import { FEATURE_CATALOG } from "./bikes";
import { getWarrantyConfig } from "./warranty";

/**
 * Customer-facing description generation (spec 26).
 *
 * - Built ONLY from structured fields that actually exist — missing data
 *   simply does not appear (no hallucinated specs).
 * - Correct Dutch, neutral honest tone for second-hand goods.
 * - Range is always presented as an estimate.
 * - The result is ALWAYS editable by the admin (descriptionTouched flag).
 */

export interface DescriptionContext {
  warrantyNote: string | null;
  deliveryNote: string | null;
}

const DEFAULT_CONTEXT: DescriptionContext = {
  warrantyNote: null,
  deliveryNote: null,
};

export async function defaultDescriptionContext(): Promise<DescriptionContext> {
  const w = await getWarrantyConfig();
  return {
    warrantyNote: w.enabled ? w.publicNote : null,
    deliveryNote: null,
  };
}

function km(n: number): string {
  return `${n} km`;
}

/** Deterministic, Dutch, field-by-field listing text. */
export function generateBikeDescription(bike: Bike, ctx: DescriptionContext = DEFAULT_CONTEXT): string {
  const parts: string[] = [];
  const b = bike as unknown as Record<string, unknown>;
  const s = (k: string): string | null => {
    const v = b[k];
    return typeof v === "string" && v.trim() ? v : v == null ? null : String(v);
  };
  const n = (k: string): number | null => (typeof b[k] === "number" ? (b[k] as number) : null);

  // --- Opening ---------------------------------------------------------------
  const cond = s("conditionGrade");
  const electric = b.isElectric === true;
  const openingBits: string[] = [];
  openingBits.push(cond ? `in ${lowerFirst(cond)}` : "in nette staat");
  if (electric) openingBits.push("elektrisch");
  const modelLine = [s("brand"), s("model")].filter(Boolean).join(" ");
  parts.push(
    `${modelLine ? `Deze ${modelLine} is ` : "Deze fiets is "}${openingBits.join(" en ")} en klaar voor gebruik.`,
  );

  // --- Specs ------------------------------------------------------------------
  const specs: string[] = [];
  const colour = s("colour");
  if (colour) specs.push(`kleur ${lowerFirst(colour)}`);
  const size = n("frameSizeCm");
  if (size) specs.push(`framemaat ${size} cm`);
  const wheel = n("wheelSizeCm");
  if (wheel) specs.push(`${wheel} inch wielen`);
  const gears = n("gears");
  if (gears) specs.push(`${gears} versnellingen`);
  const assist = n("assistanceLevels");
  if (assist) specs.push(`${assist} ondersteuningsniveaus`);
  const brakes = s("brakeInfo");
  if (brakes) specs.push(brakes);
  const drivetrain = s("drivetrainInfo");
  if (drivetrain) specs.push(drivetrain);
  if (specs.length) parts.push(`De fiets is uitgerust met ${listDutch(specs)}.`);

  // --- Electric system ---------------------------------------------------------
  if (electric) {
    const motorBits: string[] = [];
    const mfr = s("motorManufacturer");
    const mmod = s("motorModel");
    if (mfr || mmod) motorBits.push(`${[mfr, mmod].filter(Boolean).join(" ")} motor`);
    const mpos = s("motorPosition");
    if (mpos) motorBits.push(`gemonteerd in de ${mpos}`);
    const mdesc = s("motorDescription");
    if (mdesc) motorBits.push(mdesc);
    if (motorBits.length) parts.push(`De elektrische aandrijving bestaat uit ${listDutch(motorBits)}.`);
    if (b.walkAssist === true) parts.push("Er zit een loopassistent (throttle) op de fiets.");

    // Battery
    const batt: string[] = [];
    const bv = n("batteryVoltage");
    const bah = n("batteryAh");
    const bwh = n("batteryWh");
    if (bv || bah || bwh) {
      const bits: string[] = [];
      if (bv) bits.push(`${bv}V`);
      if (bah) bits.push(`${bah} Ah`);
      if (bwh) bits.push(`${bwh} Wh`);
      batt.push(`de accu is ${bits.join(" ")}`);
    }
    if (b.batteryReconditioned === true) {
      batt.push("de accu is door ons gereviseerd");
      if (b.batteryRevisionDate) {
        batt.push(`revisiedatum ${new Date(b.batteryRevisionDate as Date).toLocaleDateString("nl-NL")}`);
      }
    }
    const bcond = s("batteryCondition");
    if (bcond) batt.push(`accuconditie: ${bcond}`);
    if (batt.length) parts.push(batt.join(", ") + ".");

    const rmin = n("rangeMinKm");
    const rmax = n("rangeMaxKm");
    if (rmin && rmax) {
      parts.push(`De verwachte actieradius ligt tussen de ${km(rmin)} en ${km(rmax)}. Dit is een indicatie; de werkelijke actieradius hangt af van onder andere gewicht, snelheid, terrein en weerstand.`);
    } else if (rmax) {
      parts.push(`De verwachte actieradius is circa ${km(rmax)} (indicatief).`);
    }
    const enotes = s("electricalNotes");
    if (enotes) parts.push(enotes);
  }

  // --- Condition ---------------------------------------------------------------
  const cdesc = s("conditionDescription");
  if (cdesc) parts.push(cdesc);
  const cosmetic = s("cosmeticDefects");
  if (cosmetic) parts.push(`Aanmerkingen over de staat: ${cosmetic}`);
  const technical = s("technicalDefects");
  if (technical) parts.push(`Technische aanmerkingen: ${technical}`);
  const repair = s("repairSummary");
  if (repair) parts.push(`Onze werkplaats heeft onder andere het volgende gedaan: ${repair}`);

  // --- Equipment -----------------------------------------------------------------
  const features = Array.isArray(bike.features) ? (bike.features as string[]) : [];
  if (features.length) {
    const labels = features.map((f) => FEATURE_CATALOG[f] ?? f);
    parts.push(`Inclusief: ${listDutch(labels)}.`);
  }

  // --- Trust + closing --------------------------------------------------------------
  if (ctx.warrantyNote) parts.push(ctx.warrantyNote);
  parts.push(
    "Elke tweedehands fiets bij Demi Fietsen is een uniek exemplaar. De foto's en specificaties op deze pagina horen bij deze specifieke fiets — je koopt precies de fiets die je ziet.",
  );
  if (ctx.deliveryNote) parts.push(ctx.deliveryNote);
  parts.push("Kom gerust langs voor een proefrit. We staan graag voor je klaar.");

  return parts.join("\n\n");
}

// --- helpers --------------------------------------------------------------------

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** "a, b en c" */
function listDutch(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} en ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, en ${clean[clean.length - 1]}`;
}

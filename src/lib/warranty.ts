import { prisma } from "./prisma";

/**
 * Configurable warranty tracking (spec 25).
 *
 * Warranty wording varies across the existing Demi Fietsen content, so
 * NOTHING is hardcoded as the single truth: scopes, durations and wording
 * come from SiteSettings.warranty (admin editable) with safe defaults.
 *
 * At sale time the EXACT terms are frozen into WarrantyRecord rows, so later
 * config changes never rewrite issued warranty terms.
 *
 * IMPORTANT: warranty scope/duration is a business & legal decision — the
 * admin UI marks this configuration as "vereist controle" (requires review).
 */

export interface WarrantyScopeConfig {
  id: "fiets" | "accu" | "elektrisch";
  label: string;
  months: number;
  wording: string;
}

export interface WarrantyConfig {
  title: string;
  enabled: boolean;
  scopes: WarrantyScopeConfig[];
  /** Shown on product pages as the general warranty note. */
  publicNote: string;
  requiresReview: boolean;
}

export const DEFAULT_WARRANTY_CONFIG: WarrantyConfig = {
  title: "Garantie",
  enabled: true,
  scopes: [
    {
      id: "fiets",
      label: "Fiets (frame & onderdelen)",
      months: 3,
      wording:
        "3 maanden garantie op het frame en de mechanische onderdelen van deze fiets (peildatum: verkoopdatum).",
    },
    {
      id: "accu",
      label: "Accu",
      months: 6,
      wording:
        "6 maanden garantie op de accu van deze fiets (peildatum: verkoopdatum).",
    },
    {
      id: "elektrisch",
      label: "Elektrisch systeem",
      months: 3,
      wording:
        "3 maanden garantie op het elektrische systeem (motor, bediening) van deze fiets (peildatum: verkoopdatum).",
    },
  ],
  publicNote:
    "Op deze tweedehands fiets zit garantie. De exacte omvang is vastgelegd bij de verkoop; neem voor de details contact met ons op.",
  requiresReview: true,
};

const SCOPE_IDS: WarrantyScopeConfig["id"][] = ["fiets", "accu", "elektrisch"];

function isScopeId(v: unknown): v is WarrantyScopeConfig["id"] {
  return typeof v === "string" && (SCOPE_IDS as string[]).includes(v);
}

export async function getWarrantyConfig(): Promise<WarrantyConfig> {
  const s = await prisma.siteSettings.findFirst();
  const raw = (s?.warranty ?? {}) as Record<string, unknown>;
  if (!s?.warranty) return DEFAULT_WARRANTY_CONFIG;

  const scopes: WarrantyScopeConfig[] = (
    Array.isArray(raw.scopes) ? raw.scopes : []
  )
    .filter(
      (x): x is Record<string, unknown> => typeof x === "object" && x !== null,
    )
    .filter((x) => isScopeId(x.id))
    .map((x) => ({
      id: x.id as WarrantyScopeConfig["id"],
      label:
        typeof x.label === "string"
          ? x.label
          : (DEFAULT_WARRANTY_CONFIG.scopes.find((d) => d.id === x.id)?.label ??
            "Garantie"),
      months:
        typeof x.months === "number" && x.months >= 0
          ? Math.floor(x.months)
          : 0,
      wording:
        typeof x.wording === "string" && x.wording.trim()
          ? x.wording
          : `${x.months} maanden garantie (peildatum: verkoopdatum)`,
    }));

  return {
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : DEFAULT_WARRANTY_CONFIG.title,
    enabled: raw.enabled !== false,
    scopes: scopes.length ? scopes : DEFAULT_WARRANTY_CONFIG.scopes,
    publicNote:
      typeof raw.publicNote === "string" && raw.publicNote.trim()
        ? raw.publicNote
        : DEFAULT_WARRANTY_CONFIG.publicNote,
    requiresReview: raw.requiresReview !== false,
  };
}

/**
 * Scopes that apply to a given bike (used when freezing warranty records at
 * sale time). Returns scopes with months > 0 only.
 */
export async function getWarrantyScopes(): Promise<
  { id: "fiets" | "accu" | "elektrisch"; months: number; wording: string }[]
> {
  const config = await getWarrantyConfig();
  if (!config.enabled) return [];
  return config.scopes
    .filter((s) => s.months > 0)
    .map(({ id, months, wording }) => ({ id, months, wording }));
}

/** Public warranty note for product pages (never a legal promise). */
export async function getWarrantyPublicNote(): Promise<string> {
  const config = await getWarrantyConfig();
  return config.enabled ? config.publicNote : "";
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  const originalDay = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0),
  ).getUTCDate();
  x.setUTCDate(Math.min(originalDay, lastDay));
  return x;
}

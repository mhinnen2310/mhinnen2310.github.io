import { prisma } from "./prisma";
import type { SiteSettings } from "@prisma/client";

/**
 * Site-wide business configuration (spec 32).
 *
 * Business identity, hours, announcement, homepage copy, delivery, warranty,
 * marketplace templates, SEO defaults and legal flags all live in the
 * SiteSettings row — never in source code. The admin UI is the only place
 * where these values are changed.
 */

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  link: string | null;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface OpeningHoursEntry {
  days: string;
  hours: string;
}

export interface SeoConfig {
  siteName: string;
  description: string;
  ogImageKey: string | null;
}

export interface HomepageConfig {
  heroTitle: string | null;
  heroSubtitle: string | null;
  intro: string | null;
  showRecentlyAdded: boolean;
  showWhyUs: boolean;
  showHowItWorks: boolean;
}

export const DEFAULT_ANNOUNCEMENT: AnnouncementConfig = { enabled: false, text: "", link: null };

export const DEFAULT_HOMEPAGE: HomepageConfig = {
  heroTitle: null,
  heroSubtitle: null,
  intro: null,
  showRecentlyAdded: true,
  showWhyUs: true,
  showHowItWorks: true,
};

export const DEFAULT_SEO: SeoConfig = {
  siteName: "Demi Fietsen",
  description:
    "Tweedehands elektrische fietsen met garantie. Elke fiets is uniek, geïnspecteerd en gereviseerd. Bekijk het actuele aanbod en plan een proefrit.",
  ogImageKey: null,
};

export interface SettingsView extends Omit<
  SiteSettings,
  "announcement" | "socialLinks" | "openingHours" | "homepage" | "seo"
> {
  announcement: AnnouncementConfig;
  socialLinks: SocialLink[];
  openingHours: OpeningHoursEntry[];
  homepage: HomepageConfig;
  seo: SeoConfig;
}

function parseAnnouncement(raw: unknown): AnnouncementConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_ANNOUNCEMENT;
  const a = raw as Record<string, unknown>;
  return {
    enabled: a.enabled === true,
    text: typeof a.text === "string" ? a.text : "",
    link: typeof a.link === "string" && a.link.startsWith("/") ? a.link : null,
  };
}

function parseSocial(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .filter((x) => typeof x.label === "string" && typeof x.url === "string" && /^https?:\/\//.test(x.url))
    .slice(0, 12)
    .map((x) => ({ label: x.label as string, url: x.url as string }));
}

function parseOpeningHours(raw: unknown): OpeningHoursEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .filter((x) => typeof x.days === "string" && typeof x.hours === "string")
    .slice(0, 14)
    .map((x) => ({ days: x.days as string, hours: x.hours as string }));
}

function parseHomepage(raw: unknown): HomepageConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_HOMEPAGE;
  const h = raw as Record<string, unknown>;
  return {
    heroTitle: typeof h.heroTitle === "string" ? h.heroTitle : null,
    heroSubtitle: typeof h.heroSubtitle === "string" ? h.heroSubtitle : null,
    intro: typeof h.intro === "string" ? h.intro : null,
    showRecentlyAdded: h.showRecentlyAdded !== false,
    showWhyUs: h.showWhyUs !== false,
    showHowItWorks: h.showHowItWorks !== false,
  };
}

function parseSeo(raw: unknown): SeoConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SEO;
  const s = raw as Record<string, unknown>;
  return {
    siteName: typeof s.siteName === "string" && s.siteName.trim() ? s.siteName : DEFAULT_SEO.siteName,
    description: typeof s.description === "string" && s.description.trim() ? s.description : DEFAULT_SEO.description,
    ogImageKey: typeof s.ogImageKey === "string" ? s.ogImageKey : null,
  };
}

export function toSettingsView(s: SiteSettings): SettingsView {
  return {
    ...s,
    announcement: parseAnnouncement(s.announcement),
    socialLinks: parseSocial(s.socialLinks),
    openingHours: parseOpeningHours(s.openingHours),
    homepage: parseHomepage(s.homepage),
    seo: parseSeo(s.seo),
  };
}

function defaultSettingsView(): SettingsView {
  // Reads (including static builds) must not create business data. The first
  // intentional settings save goes through updateSettings(), which upserts the
  // singleton row. Until then the storefront uses the schema defaults here.
  return {
    id: 1,
    companyName: "Demi Fietsen",
    logoKey: null,
    faviconKey: null,
    email: null,
    phone: null,
    addressLine: null,
    postcode: null,
    city: null,
    kvkNumber: null,
    vatId: null,
    iban: null,
    announcement: DEFAULT_ANNOUNCEMENT,
    socialLinks: [],
    openingHours: [],
    homepage: DEFAULT_HOMEPAGE,
    aboutText: null,
    delivery: null,
    warranty: null,
    marketplace: null,
    seo: DEFAULT_SEO,
    analytics: null,
    tax: null,
    newsletterEnabled: true,
    updatedAt: new Date(0),
  };
}

export async function getSettings(): Promise<SettingsView> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return settings ? toSettingsView(settings) : defaultSettingsView();
}

export async function updateSettings(
  data: Partial<
    Pick<
      SiteSettings,
      | "companyName"
      | "logoKey"
      | "faviconKey"
      | "email"
      | "phone"
      | "addressLine"
      | "postcode"
      | "city"
      | "kvkNumber"
      | "vatId"
      | "iban"
      | "aboutText"
      | "newsletterEnabled"
    >
  > & {
    openingHours?: OpeningHoursEntry[] | null;
    socialLinks?: SocialLink[] | null;
    announcement?: AnnouncementConfig | null;
    homepage?: Partial<HomepageConfig> | null;
    seo?: Partial<SeoConfig> | null;
  },
): Promise<SettingsView> {
  const { openingHours, socialLinks, announcement, homepage, seo, ...rest } = data;
  const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const update: Record<string, unknown> = { ...rest };
  if (openingHours !== undefined) update.openingHours = openingHours ?? null;
  if (socialLinks !== undefined) update.socialLinks = socialLinks ?? null;
  if (announcement !== undefined) update.announcement = announcement ?? null;
  if (homepage) {
    const cur = parseHomepage(existing?.homepage);
    update.homepage = { ...cur, ...homepage };
  }
  if (seo) {
    const cur = parseSeo(existing?.seo);
    update.seo = { ...cur, ...seo };
  }
  const s = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...update } as never,
    update,
  });
  return toSettingsView(s);
}

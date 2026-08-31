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
  startAt: string | null;
  endAt: string | null;
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
  primaryCta: string | null;
  secondaryCta: string | null;
}

export interface DeliveryConfig {
  title: string | null;
  description: string | null;
  options: string[];
}

export interface WarrantyConfig {
  title: string | null;
  description: string | null;
}

export const DEFAULT_ANNOUNCEMENT: AnnouncementConfig = {
  enabled: false,
  text: "",
  link: null,
  startAt: null,
  endAt: null,
};

export const DEFAULT_HOMEPAGE: HomepageConfig = {
  heroTitle: null,
  heroSubtitle: null,
  intro: null,
  showRecentlyAdded: true,
  showWhyUs: true,
  showHowItWorks: true,
  primaryCta: null,
  secondaryCta: null,
};

export const DEFAULT_DELIVERY: DeliveryConfig = {
  title: null,
  description: null,
  options: [],
};
export const DEFAULT_WARRANTY: WarrantyConfig = {
  title: null,
  description: null,
};

export const DEFAULT_SEO: SeoConfig = {
  siteName: "Demi Fietsen",
  description:
    "Tweedehands elektrische fietsen met garantie. Elke fiets is uniek, geïnspecteerd en gereviseerd. Bekijk het actuele aanbod en plan een proefrit.",
  ogImageKey: null,
};

export interface SettingsView extends Omit<
  SiteSettings,
  | "announcement"
  | "socialLinks"
  | "openingHours"
  | "homepage"
  | "seo"
  | "delivery"
  | "warranty"
> {
  announcement: AnnouncementConfig;
  socialLinks: SocialLink[];
  openingHours: OpeningHoursEntry[];
  homepage: HomepageConfig;
  seo: SeoConfig;
  delivery: DeliveryConfig;
  warranty: WarrantyConfig;
}

function parseAnnouncement(raw: unknown): AnnouncementConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_ANNOUNCEMENT;
  const a = raw as Record<string, unknown>;
  return {
    enabled: a.enabled === true,
    text: typeof a.text === "string" ? a.text : "",
    link: typeof a.link === "string" && a.link.startsWith("/") ? a.link : null,
    startAt:
      typeof a.startAt === "string" && !Number.isNaN(Date.parse(a.startAt))
        ? a.startAt
        : null,
    endAt:
      typeof a.endAt === "string" && !Number.isNaN(Date.parse(a.endAt))
        ? a.endAt
        : null,
  };
}

function parseSocial(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => typeof x === "object" && x !== null,
    )
    .filter(
      (x) =>
        typeof x.label === "string" &&
        typeof x.url === "string" &&
        /^https?:\/\//.test(x.url),
    )
    .slice(0, 12)
    .map((x) => ({ label: x.label as string, url: x.url as string }));
}

function parseOpeningHours(raw: unknown): OpeningHoursEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => typeof x === "object" && x !== null,
    )
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
    primaryCta: typeof h.primaryCta === "string" ? h.primaryCta : null,
    secondaryCta: typeof h.secondaryCta === "string" ? h.secondaryCta : null,
  };
}

function parseSeo(raw: unknown): SeoConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SEO;
  const s = raw as Record<string, unknown>;
  return {
    siteName:
      typeof s.siteName === "string" && s.siteName.trim()
        ? s.siteName
        : DEFAULT_SEO.siteName,
    description:
      typeof s.description === "string" && s.description.trim()
        ? s.description
        : DEFAULT_SEO.description,
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
    delivery: parseDelivery(s.delivery),
    warranty: parseWarranty(s.warranty),
  };
}

function parseDelivery(raw: unknown): DeliveryConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_DELIVERY;
  const value = raw as Record<string, unknown>;
  return {
    title: typeof value.title === "string" ? value.title : null,
    description:
      typeof value.description === "string" ? value.description : null,
    options: Array.isArray(value.options)
      ? value.options
          .filter((item): item is string => typeof item === "string")
          .slice(0, 12)
      : [],
  };
}

function parseWarranty(raw: unknown): WarrantyConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_WARRANTY;
  const value = raw as Record<string, unknown>;
  return {
    title: typeof value.title === "string" ? value.title : null,
    description:
      typeof value.description === "string"
        ? value.description
        : typeof value.publicNote === "string"
          ? value.publicNote
          : null,
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
    delivery: DEFAULT_DELIVERY,
    warranty: DEFAULT_WARRANTY,
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
    delivery?: Partial<DeliveryConfig> | null;
    warranty?: Partial<WarrantyConfig> | null;
    tax?: Record<string, unknown> | null;
  },
  actorId?: string | null,
): Promise<SettingsView> {
  const {
    openingHours,
    socialLinks,
    announcement,
    homepage,
    seo,
    delivery,
    warranty,
    tax,
    ...rest
  } = data;
  const s = await prisma.$transaction(async (tx) => {
    const existing = await tx.siteSettings.findUnique({ where: { id: 1 } });
    const update: Record<string, unknown> = { ...rest };
    if (openingHours !== undefined) update.openingHours = openingHours ?? null;
    if (socialLinks !== undefined) update.socialLinks = socialLinks ?? null;
    if (announcement !== undefined) update.announcement = announcement ?? null;
    if (homepage)
      update.homepage = { ...parseHomepage(existing?.homepage), ...homepage };
    if (seo) update.seo = { ...parseSeo(existing?.seo), ...seo };
    // Keep the richer delivery/warranty structures (methods, scopes and
    // legal flags) intact while allowing the editor to update copy fields.
    if (delivery) {
      const current =
        existing?.delivery &&
        typeof existing.delivery === "object" &&
        !Array.isArray(existing.delivery)
          ? (existing.delivery as Record<string, unknown>)
          : {};
      update.delivery = { ...current, ...delivery };
    }
    if (warranty) {
      const current =
        existing?.warranty &&
        typeof existing.warranty === "object" &&
        !Array.isArray(existing.warranty)
          ? (existing.warranty as Record<string, unknown>)
          : {};
      update.warranty = { ...current, ...warranty };
    }
    if (tax) {
      const current = existing?.tax && typeof existing.tax === "object" && !Array.isArray(existing.tax)
        ? (existing.tax as Record<string, unknown>)
        : {};
      update.tax = { ...current, ...tax };
    }

    if (existing) {
      const last = await tx.siteSettingsRevision.findFirst({
        where: { settingsId: 1 },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const { id: _id, updatedAt: _updatedAt, ...snapshot } = existing;
      await tx.siteSettingsRevision.create({
        data: {
          settingsId: 1,
          version: (last?.version ?? 0) + 1,
          snapshot: JSON.parse(JSON.stringify(snapshot)),
          changedById: actorId ?? null,
        },
      });
    }
    return tx.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...update } as never,
      update,
    });
  });
  return toSettingsView(s);
}

export interface SettingsRevisionView {
  id: string;
  version: number;
  createdAt: Date;
  changedBy: { name: string | null; email: string } | null;
}

export async function listSettingsRevisions(
  limit = 30,
): Promise<SettingsRevisionView[]> {
  return prisma.siteSettingsRevision.findMany({
    where: { settingsId: 1 },
    orderBy: { version: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      version: true,
      createdAt: true,
      changedBy: { select: { name: true, email: true } },
    },
  });
}

/** Restore an immutable snapshot by creating a new revision of the current state first. */
export async function restoreSettingsRevision(
  revisionId: string,
  actorId: string,
): Promise<SettingsView | null> {
  const revision = await prisma.siteSettingsRevision.findUnique({
    where: { id: revisionId },
  });
  if (
    !revision ||
    revision.settingsId !== 1 ||
    typeof revision.snapshot !== "object" ||
    revision.snapshot === null
  )
    return null;
  const snapshot = revision.snapshot as Record<string, unknown>;
  const { id: _id, updatedAt: _updatedAt, ...data } = snapshot;
  return updateSettings(data as never, actorId);
}

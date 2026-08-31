import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// Inventory and product URLs are database-backed; generate the sitemap at
// request time so a production build never needs a live database connection.
export const dynamic = "force-dynamic";

/**
 * Sitemap (spec 31).
 *
 * Included: all public bike pages (AVAILABLE + SOLD — sold pages are kept
 * for history and may remain indexed with a clear "verkocht" state), all
 * active products, and the static pages.
 * Excluded: /winkelwagen, /checkout, /betaaling/*, /account, /admin, /api.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");

  const [bikes, products] = await Promise.all([
    prisma.bike.findMany({
      where: { status: { in: ["AVAILABLE", "SOLD"] } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticPages = [
    { path: "/", priority: 1.0, changeFreq: "daily" as const },
    { path: "/fietsen", priority: 0.9, changeFreq: "daily" as const },
    { path: "/verkocht", priority: 0.5, changeFreq: "weekly" as const },
    { path: "/accessoires", priority: 0.8, changeFreq: "daily" as const },
    { path: "/afspraak", priority: 0.7, changeFreq: "monthly" as const },
    { path: "/contact", priority: 0.5, changeFreq: "monthly" as const },
    { path: "/over-ons", priority: 0.4, changeFreq: "monthly" as const },
    { path: "/service", priority: 0.4, changeFreq: "monthly" as const },
    { path: "/nieuwsbrief", priority: 0.3, changeFreq: "monthly" as const },
    { path: "/zoeken", priority: 0.3, changeFreq: "monthly" as const },
    { path: "/privacy", priority: 0.2, changeFreq: "yearly" as const },
    {
      path: "/algemene-voorwaarden",
      priority: 0.2,
      changeFreq: "yearly" as const,
    },
    { path: "/retourbeleid", priority: 0.2, changeFreq: "yearly" as const },
    { path: "/cookiebeleid", priority: 0.2, changeFreq: "yearly" as const },
  ];

  return [
    ...staticPages.map((p) => ({
      url: `${base}${p.path}`,
      lastmod: new Date().toISOString(),
      changeFrequency: p.changeFreq,
      priority: p.priority,
    })),
    ...bikes.map((b) => ({
      url: `${base}/fietsen/${b.slug}`,
      lastmod: b.updatedAt.toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/accessoires/${p.slug}`,
      lastmod: p.updatedAt.toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

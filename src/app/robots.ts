import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.siteUrl.replace(/\/$/, "");
  if (env.isPreview) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/winkelwagen", "/checkout", "/betaaling/", "/account", "/inloggen", "/order-status"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

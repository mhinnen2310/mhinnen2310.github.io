import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Shopify URL migration (spec 31).
 *
 * Old public URLs (e.g. /products/sparta-c2-2455, /products/accu-houder)
 * are mapped in the UrlRedirect table (source "shopify") and served as
 * permanent redirects — so indexed pages and bookmarks keep working after
 * the migration. Unknown paths fall through to the 404 page.
 *
 * This catch-all only runs for URLs that no other route handles, so real
 * pages always win.
 */
export const dynamic = "force-dynamic";

export default async function LegacyPathRedirect({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const oldPath = `/${path.map((segment) => decodeURIComponent(segment)).join("/")}`;

  const redirect = await prisma.urlRedirect.findFirst({
    where: { oldPath, active: true },
    select: { newPath: true },
  });

  if (redirect) {
    permanentRedirect(redirect.newPath);
  }
  notFound();
}

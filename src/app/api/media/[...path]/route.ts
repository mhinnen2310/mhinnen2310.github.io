import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { contentTypeForMediaPath } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getStaffUser } from "@/lib/admin-auth";

/**
 * Media delivery endpoint.
 *
 * URL shape: /api/media/<scope>/<uuid>/<file>
 *   file: orig.jpg | orig.png | w-<width>.webp | a-<width>.avif
 *
 * Keys are uuid-based and immutable, so responses are cacheable for a
 * long time. Path traversal is impossible: every segment is validated.
 */

const SEGMENT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const FILE_RE = /^(orig\.(jpg|jpeg|png|webp)|w-\d{2,5}\.webp|a-\d{2,5}\.avif)$/;

type MediaVisibility = "public" | "private";

async function mediaVisibility(key: string): Promise<MediaVisibility | null> {
  const [bikeImage, productImage, siteAsset] = await Promise.all([
    prisma.bikeImage.findUnique({ where: { storageKey: key }, select: { isInternal: true } }),
    prisma.productImage.findUnique({ where: { storageKey: key }, select: { id: true } }),
    prisma.siteSettings.findFirst({ where: { OR: [{ logoKey: key }, { faviconKey: key }] }, select: { id: true } }),
  ]);
  if (productImage || siteAsset) return "public";
  if (bikeImage) return bikeImage.isInternal ? "private" : "public";

  const scope = key.split("/", 1)[0];
  if (scope === "battery-labels") {
    const [bikeLabel, batteryLabel] = await Promise.all([
      prisma.bike.findFirst({ where: { batteryLabelPhotoKey: key }, select: { id: true } }),
      prisma.battery.findFirst({ where: { labelPhotoKey: key }, select: { id: true } }),
    ]);
    return bikeLabel || batteryLabel ? "private" : null;
  }
  if (scope === "workshop") {
    return await prisma.serviceTask.findFirst({ where: { photoKeys: { has: key } }, select: { id: true } }) ? "private" : null;
  }
  if (scope === "service") {
    return await prisma.serviceRequest.findFirst({ where: { photoKeys: { has: key } }, select: { id: true } }) ? "private" : null;
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!Array.isArray(path) || path.length < 2) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const file = path[path.length - 1];
  const keySegments = path.slice(0, -1);
  if (!file) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  if (keySegments.length < 2) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }
  if (!keySegments.every((s) => SEGMENT_RE.test(s)) || !FILE_RE.test(file)) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const key = `${keySegments.join("/")}/${file}`;
  const baseKey = keySegments.join("/");
  const visibility = await mediaVisibility(baseKey);
  if (!visibility) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  if (visibility === "private" && !await getStaffUser()) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404, headers: { "cache-control": "private, no-store" } });
  }
  const found = await storage.get(key);
  if (!found || found.data.length === 0) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const contentType = contentTypeForMediaPath(file) ?? "application/octet-stream";
  const buf = Buffer.from(found.data);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(buf.length),
      "cache-control": visibility === "public"
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      ...(visibility === "private" ? { vary: "Cookie" } : {}),
    },
  });
}

import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { contentTypeForMediaPath } from "@/lib/media";

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
      // uuid-keyed files never change content
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

import sharp from "sharp";
import { randomToken } from "./utils";
import { storage } from "./storage";
import { IMAGE_WIDTHS } from "./media";

/**
 * Image processing pipeline.
 * - strips EXIF (privacy: GPS etc.)
 * - stores a normalised original
 * - generates responsive WebP variants (+ AVIF when the sharp build supports it)
 *
 * Files live under:  <storage>/<scope>/<uuid>/
 *   orig.<ext>       original (EXIF-stripped)
 *   w-<width>.webp   responsive webp variants
 *   a-<width>.avif   responsive avif variants (when available)
 *
 * The DB stores only the base key `<scope>/<uuid>` plus dimensions.
 */

// AVIF write support depends on the libvips build this sharp was compiled
// with. Probe it once at runtime (the type surface differs between builds).
let avifProbe: Promise<boolean> | null = null;
function isAvifSupported(): Promise<boolean> {
  if (!avifProbe) {
    avifProbe = sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .avif()
      .toBuffer()
      .then(() => true)
      .catch(() => false);
  }
  return avifProbe;
}

export interface ProcessedImage {
  key: string;
  originalFile: string;
  width: number;
  height: number;
  avif: boolean;
  bytesOriginal: number;
}

function extForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "jpg";
    default:
      return "bin";
  }
}

export async function processImageUpload(
  buffer: Buffer,
  mime: string,
  scope: string,
): Promise<ProcessedImage> {
  const safeScope = scope.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "media";
  const uuid = randomToken(16);
  const key = `${safeScope}/${uuid}`;
  const originalExt = extForMime(mime);

  // Normalise: strip EXIF, cap max edge at 2200px for the stored original.
  const pipeline = sharp(buffer, { animated: false }).rotate(); // auto-orient
  const meta = await pipeline.metadata();
  const originalBuffer = await pipeline
    .resize({ width: 2200, withoutEnlargement: true })
    .toFormat(originalExt === "png" ? "png" : "jpeg", { quality: 85 })
    .toBuffer();

  const finalExt = originalExt === "png" ? "png" : "jpg";
  const originalFile = `orig.${finalExt}`;
  await storage.put(
    `${key}/${originalFile}`,
    originalBuffer,
    finalExt === "png" ? "image/png" : "image/jpeg",
  );

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const avif = await isAvifSupported();

  // Responsive variants
  const jobs: Promise<unknown>[] = [];
  for (const w of IMAGE_WIDTHS) {
    jobs.push(
      sharp(originalBuffer)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
        .then((buf) => storage.put(`${key}/w-${w}.webp`, buf, "image/webp")),
    );
    if (avif) {
      jobs.push(
        sharp(originalBuffer)
          .resize({ width: w, withoutEnlargement: true })
          .avif({ quality: 62 })
          .toBuffer()
          .then((buf) => storage.put(`${key}/a-${w}.avif`, buf, "image/avif")),
      );
    }
  }
  await Promise.all(jobs);

  return { key, originalFile, width, height, avif, bytesOriginal: originalBuffer.length };
}

/** Remove all normalised files belonging to one database image record. */
export async function deleteProcessedImage(key: string): Promise<void> {
  const candidates = [
    "orig.jpg", "orig.png", "orig.webp", "orig.avif", "orig.bin",
    ...IMAGE_WIDTHS.flatMap((width) => [`w-${width}.webp`, `a-${width}.avif`]),
  ];
  await Promise.allSettled(candidates.map((file) => storage.delete(`${key}/${file}`)));
}

// URL helpers live in ./media.ts (single source of truth).

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB per image

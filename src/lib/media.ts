// This module is imported by browser components. Keep shared media constants
// here rather than importing the server-only image-processing pipeline (sharp).
export const IMAGE_WIDTHS = [256, 400, 800, 1200, 1600] as const;

function encodedMediaKey(key: string): string {
  return key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

/**
 * Media URL helpers.
 *
 * Stored layout (object storage / local disk):
 *   <scope>/<uuid>/orig.jpg          normalised original (EXIF stripped)
 *   <scope>/<uuid>/w-<width>.webp    responsive WebP
 *   <scope>/<uuid>/a-<width>.avif    responsive AVIF (when the build supports it)
 */

export function mediaOriginalUrl(key: string, file: string): string {
  return `/api/media/${encodedMediaKey(key)}/${encodeURIComponent(file)}`;
}

export function mediaWidthUrl(key: string, width: number, format: "webp" | "avif" = "webp"): string {
  const prefix = format === "avif" ? "a" : "w";
  return `/api/media/${encodedMediaKey(key)}/${prefix}-${width}.${format}`;
}

/**
 * Build a srcset of WebP variants (plus the original as the largest tier).
 * The browser picks the closest width; AVIF can be added per-request via <img>
 * fetch priority but WebP is universally supported and fast.
 */
export function mediaSrcSet(
  key: string,
  maxBytesHint?: number,
): { src: string; srcSet: string; sizes?: string } {
  const widths = [...IMAGE_WIDTHS].sort((a, b) => a - b);
  const parts = widths.map((w) => `${mediaWidthUrl(key, w)} ${w}w`);
  const largest = widths[widths.length - 1] ?? 1600;
  return {
    src: mediaWidthUrl(key, largest),
    srcSet: parts.join(", "),
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  };
}

export const MEDIA_CONTENT_TYPES: Record<string, string> = {
  "orig.jpg": "image/jpeg",
  "orig.png": "image/png",
  "orig.webp": "image/webp",
  "orig.bin": "application/octet-stream",
};

export function contentTypeForMediaPath(pathname: string): string | null {
  const ext = pathname.slice(pathname.lastIndexOf(".") + 1);
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  return null;
}

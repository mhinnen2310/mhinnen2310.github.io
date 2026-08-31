import type { SessionUser } from "./auth";
import { audit } from "./audit";
import { deleteProcessedImage, MAX_UPLOAD_BYTES, processImageUpload } from "./images";
import { prisma } from "./prisma";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export class BikeImageError extends Error { constructor(message: string) { super(message); this.name = "BikeImageError"; } }

/** Shared upload operation for browser admin and mobile intake. */
export async function addBikeImage(bikeId: string, image: File, actor: SessionUser) {
  if (!ACCEPTED_IMAGE_TYPES.has(image.type)) throw new BikeImageError("Gebruik een JPEG, PNG, WebP, AVIF of GIF-afbeelding.");
  if (image.size <= 0 || image.size > MAX_UPLOAD_BYTES) throw new BikeImageError("De afbeelding is leeg of groter dan 20 MB.");
  const bike = await prisma.bike.findUnique({ where: { id: bikeId }, select: { id: true } });
  if (!bike) throw new BikeImageError("Fiets niet gevonden.");
  const processed = await processImageUpload(Buffer.from(await image.arrayBuffer()), image.type, "bikes");
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bike-images:${bikeId}`}, 0))`;
      const [imageCount, lastImage] = await Promise.all([
        tx.bikeImage.count({ where: { bikeId } }),
        tx.bikeImage.findFirst({ where: { bikeId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
      ]);
      return tx.bikeImage.create({
        data: { bikeId, storageKey: processed.key, width: processed.width, height: processed.height, sortOrder: (lastImage?.sortOrder ?? -1) + 1, isCover: imageCount === 0 },
        select: { id: true, storageKey: true, width: true, height: true, isCover: true, isInternal: true },
      });
    });
  } catch (error) {
    await deleteProcessedImage(processed.key);
    throw error;
  }
  await audit("bike.image_added", "Bike", bikeId, { imageId: created.id }, actor);
  return created;
}

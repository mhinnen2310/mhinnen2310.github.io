-- P1-A: extend the existing bike dossier without changing historic records.
-- SALE_PENDING is lifecycle-owned (not a generic admin status) and provides
-- a safe state for future in-store/terminal completion work.
ALTER TYPE "BikeStatus" ADD VALUE IF NOT EXISTS 'SALE_PENDING';

-- A model can have a separate trim/edition and a known model year. Both are
-- nullable because imported and older stock often lacks this information.
ALTER TABLE "Bike"
  ADD COLUMN "variant" TEXT,
  ADD COLUMN "modelYear" INTEGER;

-- Workshop/intake images can be useful internally while being unsuitable for
-- a public advert. Existing images remain public to preserve current listings.
ALTER TABLE "BikeImage"
  ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "BikeImage_bikeId_isInternal_sortOrder_idx"
  ON "BikeImage"("bikeId", "isInternal", "sortOrder");

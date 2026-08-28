-- Align the database with the checked-in Prisma schema without resetting data.
-- Existing legacy counters are retained as order counters, so already-issued
-- order numbers can never be reused after the counter split.

-- AlterTable
ALTER TABLE "Bike" ADD COLUMN "realisedSalePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "NumberCounter"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'order';

ALTER TABLE "NumberCounter"
  ALTER COLUMN "kind" DROP DEFAULT,
  DROP CONSTRAINT "NumberCounter_pkey",
  ADD CONSTRAINT "NumberCounter_pkey" PRIMARY KEY ("year", "kind");

-- DropIndex
DROP INDEX "Invoice_orderId_key";

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

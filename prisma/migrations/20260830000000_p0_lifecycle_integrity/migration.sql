-- P0 lifecycle integrity and data-type corrections.
--
-- This migration is intentionally additive/data-preserving. Existing wheel
-- sizes were already stored as conventional inch values (for example 28), so
-- only the misleading column name changes; no unit conversion is applied.

-- Correct specification/cost data types before production data arrives.
ALTER TABLE "Bike" RENAME COLUMN "wheelSizeCm" TO "wheelSizeInches";
ALTER TABLE "Bike"
  ALTER COLUMN "wheelSizeInches" TYPE DECIMAL(4, 1)
  USING "wheelSizeInches"::DECIMAL(4, 1);
ALTER TABLE "Bike"
  ALTER COLUMN "batteryAh" TYPE DECIMAL(5, 2)
  USING "batteryAh"::DECIMAL(5, 2);
ALTER TABLE "Bike" RENAME COLUMN "labourHours" TO "labourMinutes";
UPDATE "Bike"
SET "labourMinutes" = "labourMinutes" * 60
WHERE "labourMinutes" IS NOT NULL;

-- Keep the business payment method independently of the transport/provider.
CREATE TYPE "PaymentMethod" AS ENUM ('MOLLIE', 'SUMUP', 'CASH', 'BANK_TRANSFER', 'MOCK');
ALTER TABLE "Payment"
  ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'MOLLIE';
UPDATE "Payment"
SET "method" = CASE lower("provider")
  WHEN 'mock' THEN 'MOCK'::"PaymentMethod"
  WHEN 'sumup' THEN 'SUMUP'::"PaymentMethod"
  WHEN 'cash' THEN 'CASH'::"PaymentMethod"
  WHEN 'bank_transfer' THEN 'BANK_TRANSFER'::"PaymentMethod"
  ELSE 'MOLLIE'::"PaymentMethod"
END;

-- A bike may have at most one active hold. In the unlikely event legacy data
-- contains multiple active rows, retain the most order-specific checkout hold
-- and release the older/conflicting rows before installing the invariant.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "bikeId"
      ORDER BY
        CASE WHEN "orderId" IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN "source" = 'CHECKOUT' THEN 0 ELSE 1 END,
        "createdAt" DESC,
        "id" DESC
    ) AS position
  FROM "Reservation"
  WHERE "status" = 'ACTIVE'
)
UPDATE "Reservation" AS reservation
SET "status" = 'RELEASED', "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE reservation."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "Reservation_one_active_bike_key"
  ON "Reservation"("bikeId")
  WHERE "status" = 'ACTIVE';

-- A normal issued invoice is singular per order. Historic duplicate issued
-- documents are preserved for auditability: only the canonical oldest record
-- receives the unique key; all historical duplicates remain untouched.
ALTER TABLE "Invoice" ADD COLUMN "issuedOrderKey" TEXT;
WITH ranked AS (
  SELECT
    "id",
    "orderId",
    row_number() OVER (
      PARTITION BY "orderId"
      ORDER BY "issuedAt" ASC, "createdAt" ASC, "id" ASC
    ) AS position
  FROM "Invoice"
  WHERE "status" = 'ISSUED'
)
UPDATE "Invoice" AS invoice
SET "issuedOrderKey" = ranked."orderId"
FROM ranked
WHERE invoice."id" = ranked."id" AND ranked.position = 1;

CREATE UNIQUE INDEX "Invoice_issuedOrderKey_key" ON "Invoice"("issuedOrderKey");

-- Webhook processing is leased rather than merely "received": a worker that
-- crashes after accepting an event can be reclaimed safely after its lease.
ALTER TYPE "WebhookStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TABLE "WebhookEvent"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "WebhookEvent"
SET "updatedAt" = COALESCE("processedAt", "createdAt");

-- The old ip-Base64 representation was reversible. It cannot be safely
-- converted without an application secret during SQL migration, so erase only
-- those legacy fingerprints instead of preserving personal data in a weaker
-- form. New rows use the keyed ip-hmac-v1 format.
UPDATE "ContactMessage"
SET "ipHash" = NULL
WHERE "ipHash" LIKE 'ip-%' AND "ipHash" NOT LIKE 'ip-hmac-v1-%';
UPDATE "AuditLog"
SET "ipHash" = NULL
WHERE "ipHash" LIKE 'ip-%' AND "ipHash" NOT LIKE 'ip-hmac-v1-%';

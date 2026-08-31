-- Password changes increment this value, invalidating stateless browser JWTs.
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- A batch remembers the exact permanent host used in its printed payloads so
-- regenerating a PDF cannot silently change already issued QR destinations.
ALTER TABLE "QrBatch"
ADD COLUMN "qrBaseUrl" TEXT NOT NULL DEFAULT 'https://demifietsen.nl';

-- Cumulative refunded amount makes repeated partial-refund validation exact.
ALTER TABLE "Order"
ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;

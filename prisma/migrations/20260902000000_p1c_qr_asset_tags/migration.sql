CREATE TYPE "QrTagStatus" AS ENUM ('UNUSED', 'BOUND', 'RETIRED');

CREATE TABLE "QrBatch" (
  "id" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "firstSerialNumber" INTEGER NOT NULL,
  "lastSerialNumber" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "labelsPerPage" INTEGER NOT NULL DEFAULT 15,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "QrBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QrBatch_batchNumber_key" ON "QrBatch"("batchNumber");
CREATE INDEX "QrBatch_createdAt_idx" ON "QrBatch"("createdAt");
ALTER TABLE "QrBatch" ADD CONSTRAINT "QrBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QrTag" (
  "id" TEXT NOT NULL,
  "serialNumber" INTEGER NOT NULL,
  "displayCode" TEXT NOT NULL,
  "secureToken" TEXT NOT NULL,
  "status" "QrTagStatus" NOT NULL DEFAULT 'UNUSED',
  "batchId" TEXT NOT NULL,
  "bikeId" TEXT,
  "boundAt" TIMESTAMP(3),
  "boundById" TEXT,
  "retiredAt" TIMESTAMP(3),
  "retiredReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QrTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QrTag_serialNumber_key" ON "QrTag"("serialNumber");
CREATE UNIQUE INDEX "QrTag_displayCode_key" ON "QrTag"("displayCode");
CREATE UNIQUE INDEX "QrTag_secureToken_key" ON "QrTag"("secureToken");
CREATE UNIQUE INDEX "QrTag_bikeId_key" ON "QrTag"("bikeId");
CREATE INDEX "QrTag_status_serialNumber_idx" ON "QrTag"("status", "serialNumber");
CREATE INDEX "QrTag_batchId_idx" ON "QrTag"("batchId");
CREATE INDEX "QrTag_bikeId_idx" ON "QrTag"("bikeId");
ALTER TABLE "QrTag" ADD CONSTRAINT "QrTag_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QrBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrTag" ADD CONSTRAINT "QrTag_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrTag" ADD CONSTRAINT "QrTag_boundById_fkey" FOREIGN KEY ("boundById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

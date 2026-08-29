-- P1-B: per-bike intake, workshop inspection and measured battery dossier.
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'ATTENTION', 'FAIL', 'NOT_APPLICABLE');

ALTER TABLE "Bike"
  ADD COLUMN "batteryManufacturer" TEXT,
  ADD COLUMN "batteryModel" TEXT,
  ADD COLUMN "batteryMeasuredAh" DECIMAL(5, 2),
  ADD COLUMN "batteryMeasuredWh" INTEGER,
  ADD COLUMN "batterySohPercent" DECIMAL(5, 2),
  ADD COLUMN "batteryTestDate" TIMESTAMP(3),
  ADD COLUMN "batteryTestMethod" TEXT,
  ADD COLUMN "batteryCycleCount" INTEGER,
  ADD COLUMN "batteryLabelPhotoKey" TEXT;

ALTER TABLE "ServiceTask"
  ADD COLUMN "checklistKey" TEXT,
  ADD COLUMN "inspectionResult" "InspectionResult",
  ADD COLUMN "partName" TEXT,
  ADD COLUMN "labourMinutes" INTEGER,
  ADD COLUMN "labourCostCents" INTEGER,
  ADD COLUMN "photoKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "completedById" TEXT,
  ADD COLUMN "costAppliedAt" TIMESTAMP(3);

-- Existing service-task costs were already added to Bike totals by the old
-- code. Mark them as booked so P1-B completion cannot charge them twice.
UPDATE "ServiceTask" SET "costAppliedAt" = "createdAt";

ALTER TABLE "ServiceTask"
  ADD CONSTRAINT "ServiceTask_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ServiceTask_bikeId_checklistKey_key"
  ON "ServiceTask"("bikeId", "checklistKey");
CREATE INDEX "ServiceTask_completedById_idx" ON "ServiceTask"("completedById");

CREATE TABLE "BikeIntake" (
  "id" TEXT NOT NULL,
  "bikeId" TEXT NOT NULL,
  "frameSerialPresent" BOOLEAN NOT NULL DEFAULT false,
  "keysPresent" BOOLEAN NOT NULL DEFAULT false,
  "chargerPresent" BOOLEAN NOT NULL DEFAULT false,
  "batteryPresent" BOOLEAN NOT NULL DEFAULT false,
  "defectsAssessed" BOOLEAN NOT NULL DEFAULT false,
  "knownDefects" TEXT,
  "theftCheckCompleted" BOOLEAN NOT NULL DEFAULT false,
  "theftCheckDate" TIMESTAMP(3),
  "theftCheckResult" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BikeIntake_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BikeIntake_bikeId_key" ON "BikeIntake"("bikeId");
CREATE INDEX "BikeIntake_theftCheckCompleted_idx" ON "BikeIntake"("theftCheckCompleted");
ALTER TABLE "BikeIntake"
  ADD CONSTRAINT "BikeIntake_bikeId_fkey"
  FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE CASCADE ON UPDATE CASCADE;

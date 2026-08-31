-- Independent, reusable battery assets (legacy Bike battery columns remain).
CREATE TYPE "BatteryStatus" AS ENUM ('INTAKE', 'WORKSHOP', 'READY', 'STOCK', 'ASSIGNED', 'RETIRED');

CREATE TABLE "Battery" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "type" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "voltage" INTEGER,
    "nominalAh" DECIMAL(5,2),
    "nominalWh" INTEGER,
    "measuredAh" DECIMAL(5,2),
    "measuredWh" INTEGER,
    "sohPercent" DECIMAL(5,2),
    "testDate" TIMESTAMP(3),
    "testMethod" TEXT,
    "cycleCount" INTEGER,
    "condition" TEXT,
    "reconditioned" BOOLEAN,
    "revisionDate" TIMESTAMP(3),
    "rangeMinKm" INTEGER,
    "rangeMaxKm" INTEGER,
    "warrantyMonths" INTEGER,
    "notes" TEXT,
    "labelPhotoKey" TEXT,
    "acquisitionCostCents" INTEGER,
    "partsCostCents" INTEGER NOT NULL DEFAULT 0,
    "repairCostCents" INTEGER NOT NULL DEFAULT 0,
    "labourMinutes" INTEGER,
    "status" "BatteryStatus" NOT NULL DEFAULT 'INTAKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Battery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Bike" ADD COLUMN "currentBatteryId" TEXT;

CREATE TABLE "BatteryAssignment" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "note" TEXT,
    "changedById" TEXT,
    CONSTRAINT "BatteryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatteryRepair" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "partName" TEXT,
    "partCostCents" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "labourMinutes" INTEGER,
    "labourCostCents" INTEGER,
    "internalNotes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "doneDate" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BatteryRepair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Battery_assetCode_key" ON "Battery"("assetCode");
CREATE UNIQUE INDEX "Bike_currentBatteryId_key" ON "Bike"("currentBatteryId");
CREATE INDEX "Battery_status_updatedAt_idx" ON "Battery"("status", "updatedAt");
CREATE INDEX "Battery_manufacturer_model_idx" ON "Battery"("manufacturer", "model");
CREATE INDEX "Battery_serialNumber_idx" ON "Battery"("serialNumber");
CREATE INDEX "BatteryAssignment_batteryId_assignedAt_idx" ON "BatteryAssignment"("batteryId", "assignedAt");
CREATE INDEX "BatteryAssignment_bikeId_assignedAt_idx" ON "BatteryAssignment"("bikeId", "assignedAt");
CREATE INDEX "BatteryRepair_batteryId_completed_idx" ON "BatteryRepair"("batteryId", "completed");
CREATE INDEX "BatteryRepair_completedById_idx" ON "BatteryRepair"("completedById");

ALTER TABLE "Bike" ADD CONSTRAINT "Bike_currentBatteryId_fkey" FOREIGN KEY ("currentBatteryId") REFERENCES "Battery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BatteryRepair" ADD CONSTRAINT "BatteryRepair_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatteryRepair" ADD CONSTRAINT "BatteryRepair_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

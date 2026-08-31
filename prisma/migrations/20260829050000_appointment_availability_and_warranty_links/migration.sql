-- Admin-managed appointment availability. No rows are inserted: the calendar
-- is intentionally closed until the owner adds weekly or date-specific slots.
CREATE TABLE "AppointmentAvailabilityRule" (
  "id" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "slotMinutes" INTEGER NOT NULL DEFAULT 60,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentAvailabilityRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentAvailabilityOverride" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "closed" BOOLEAN NOT NULL DEFAULT false,
  "startTime" TEXT,
  "endTime" TEXT,
  "slotMinutes" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WarrantyRecord" ADD COLUMN "bikeId" TEXT;

CREATE INDEX "AppointmentAvailabilityRule_weekday_active_idx"
  ON "AppointmentAvailabilityRule"("weekday", "active");
CREATE INDEX "AppointmentAvailabilityOverride_date_idx"
  ON "AppointmentAvailabilityOverride"("date");
CREATE INDEX "WarrantyRecord_bikeId_idx" ON "WarrantyRecord"("bikeId");

ALTER TABLE "WarrantyRecord"
  ADD CONSTRAINT "WarrantyRecord_bikeId_fkey"
  FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allow administrators to disable accounts while retaining their history.
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Immutable before-change snapshots for live website editing and rollback.
CREATE TABLE "SiteSettingsRevision" (
    "id" TEXT NOT NULL,
    "settingsId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSettingsRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteSettingsRevision_settingsId_version_key"
ON "SiteSettingsRevision"("settingsId", "version");

CREATE INDEX "SiteSettingsRevision_settingsId_createdAt_idx"
ON "SiteSettingsRevision"("settingsId", "createdAt");

CREATE INDEX "SiteSettingsRevision_changedById_idx"
ON "SiteSettingsRevision"("changedById");

ALTER TABLE "SiteSettingsRevision"
ADD CONSTRAINT "SiteSettingsRevision_settingsId_fkey"
FOREIGN KEY ("settingsId") REFERENCES "SiteSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteSettingsRevision"
ADD CONSTRAINT "SiteSettingsRevision_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

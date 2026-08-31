-- Preserve the acquisition basis used for each unique-bike sale. This keeps
-- historical margin/VAT reporting stable when a bike dossier is edited later.
ALTER TABLE "OrderLine" ADD COLUMN "acquisitionCostCents" INTEGER;
ALTER TABLE "OrderLine" ADD COLUMN "marginCents" INTEGER;
ALTER TABLE "OrderLine" ADD COLUMN "marginVatCents" INTEGER;
ALTER TABLE "OrderLine" ADD COLUMN "taxScheme" TEXT;

-- Existing rows are left nullable deliberately: old orders did not persist a
-- margin basis and must be marked for accountant review rather than guessed.

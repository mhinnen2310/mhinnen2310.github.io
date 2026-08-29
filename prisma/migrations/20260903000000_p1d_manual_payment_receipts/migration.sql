ALTER TABLE "Payment" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "confirmedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN "cashReceivedCents" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "changeReturnedCents" INTEGER;
CREATE INDEX "Payment_confirmedById_idx" ON "Payment"("confirmedById");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

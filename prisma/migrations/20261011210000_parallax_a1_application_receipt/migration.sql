-- Atomic reviewed-application metadata without additional authored or credential content.
ALTER TABLE "AIUsageLedger" ADD COLUMN "applicationKey" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "applicationFingerprint" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "applicationRevision" INTEGER;
ALTER TABLE "AIUsageLedger" ADD COLUMN "applicationChecksum" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "appliedAt" DATETIME;
CREATE UNIQUE INDEX "AIUsageLedger_accountId_applicationKey_key" ON "AIUsageLedger"("accountId", "applicationKey");

-- Cross-project ownership is additive. SQLite cannot add a foreign-key
-- constraint to an existing table without rebuilding it, so application and
-- Prisma relations enforce referential checks here; MySQL adds physical FKs.
ALTER TABLE "PrivateContentImport" ADD COLUMN "ownerAccountId" TEXT;
ALTER TABLE "PrivateAssetReference" ADD COLUMN "ownerAccountId" TEXT;
CREATE INDEX "PrivateContentImport_ownerAccountId_createdAt_idx" ON "PrivateContentImport"("ownerAccountId", "createdAt");
CREATE INDEX "PrivateContentImport_sourceTaleId_idx" ON "PrivateContentImport"("sourceTaleId");
CREATE INDEX "PrivateAssetReference_ownerAccountId_idx" ON "PrivateAssetReference"("ownerAccountId");
CREATE INDEX "PrivateAssetReference_taleId_idx" ON "PrivateAssetReference"("taleId");

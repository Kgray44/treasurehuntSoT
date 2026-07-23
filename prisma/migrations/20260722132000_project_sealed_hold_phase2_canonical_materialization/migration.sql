-- Phase 2 retry payload/key records are additive; canonical rows use existing Chronicle tables.
CREATE TABLE "PrivateContentWrappedKey" (
  "id" TEXT NOT NULL PRIMARY KEY, "provider" TEXT NOT NULL, "keyVersion" TEXT NOT NULL, "wrappedKey" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PrivateContentWrappedKey_provider_keyVersion_idx" ON "PrivateContentWrappedKey"("provider", "keyVersion");
CREATE TABLE "PrivateContentEncryptedPayload" (
  "id" TEXT NOT NULL PRIMARY KEY, "objectKey" TEXT NOT NULL, "sha256" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
  "cipher" TEXT NOT NULL, "wrappedKeyId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PrivateContentEncryptedPayload_objectKey_key" ON "PrivateContentEncryptedPayload"("objectKey");
CREATE INDEX "PrivateContentEncryptedPayload_wrappedKeyId_idx" ON "PrivateContentEncryptedPayload"("wrappedKeyId");

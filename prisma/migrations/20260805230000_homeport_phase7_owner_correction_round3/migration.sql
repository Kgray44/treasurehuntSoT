-- Project Homeport Phase 7 owner correction Round 3: verification, workspace entry, media crop lifecycle, and provider receipts.
ALTER TABLE "UserAccount" ADD COLUMN "ordinaryWorkspaceEntryAt" DATETIME;

ALTER TABLE "AccountToken" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AccountToken" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "AccountToken" ADD COLUMN "lastAttemptAt" DATETIME;

ALTER TABLE "AccountSession" ADD COLUMN "sessionType" VARCHAR(32) NOT NULL DEFAULT 'ORDINARY';

CREATE TABLE "TransactionalEmailDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "accountTokenId" TEXT,
  "purpose" VARCHAR(64) NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "recipientHash" CHAR(64) NOT NULL,
  "providerMessageId" VARCHAR(191),
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "submittedAt" DATETIME,
  "deliveredAt" DATETIME,
  "bouncedAt" DATETIME,
  "failureCode" VARCHAR(64),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TransactionalEmailDelivery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransactionalEmailDelivery_accountTokenId_fkey" FOREIGN KEY ("accountTokenId") REFERENCES "AccountToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TransactionalEmailDelivery_accountTokenId_key" ON "TransactionalEmailDelivery"("accountTokenId");
CREATE UNIQUE INDEX "TransactionalEmailDelivery_providerMessageId_key" ON "TransactionalEmailDelivery"("providerMessageId");
CREATE INDEX "TransactionalEmailDelivery_accountId_purpose_createdAt_idx" ON "TransactionalEmailDelivery"("accountId", "purpose", "createdAt");
CREATE INDEX "TransactionalEmailDelivery_status_createdAt_idx" ON "TransactionalEmailDelivery"("status", "createdAt");

CREATE TABLE "TransactionalEmailEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerEventKey" VARCHAR(255) NOT NULL,
  "providerMessageId" VARCHAR(191) NOT NULL,
  "recordType" VARCHAR(32) NOT NULL,
  "payloadChecksum" CHAR(64) NOT NULL,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TransactionalEmailEvent_providerEventKey_key" ON "TransactionalEmailEvent"("providerEventKey");
CREATE INDEX "TransactionalEmailEvent_providerMessageId_recordType_idx" ON "TransactionalEmailEvent"("providerMessageId", "recordType");

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ProfileMedia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "ownerAccountId" TEXT,
  "kind" VARCHAR(16) NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "originalStorageKey" VARCHAR(255),
  "mimeType" VARCHAR(191) NOT NULL,
  "originalMimeType" VARCHAR(191),
  "byteLength" INTEGER NOT NULL,
  "originalByteLength" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "originalWidth" INTEGER,
  "originalHeight" INTEGER,
  "checksum" CHAR(64),
  "cropCenterX" REAL NOT NULL DEFAULT 0.5,
  "cropCenterY" REAL NOT NULL DEFAULT 0.5,
  "cropScale" REAL NOT NULL DEFAULT 1,
  "cropAspect" REAL NOT NULL DEFAULT 1,
  "sourceOrientation" INTEGER NOT NULL DEFAULT 1,
  "rotation" INTEGER NOT NULL DEFAULT 0,
  "processingState" VARCHAR(32) NOT NULL DEFAULT 'READY',
  "scanState" VARCHAR(32) NOT NULL DEFAULT 'LOCAL_VALIDATED',
  "replacesMediaId" TEXT,
  "altText" VARCHAR(240),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" DATETIME,
  CONSTRAINT "ProfileMedia_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfileMedia_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProfileMedia_replacesMediaId_fkey" FOREIGN KEY ("replacesMediaId") REFERENCES "ProfileMedia" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ProfileMedia" (
  "id", "profileId", "ownerAccountId", "kind", "storageKey", "mimeType", "byteLength", "width", "height",
  "altText", "createdAt", "updatedAt", "removedAt", "cropAspect"
)
SELECT
  media."id", media."profileId", profile."accountId", media."kind", media."storageKey", media."mimeType",
  media."byteLength", media."width", media."height", media."altText", media."createdAt", media."createdAt",
  media."removedAt", CASE WHEN media."kind" = 'BANNER' THEN 2.5 ELSE 1 END
FROM "ProfileMedia" AS media
LEFT JOIN "PlayerProfile" AS profile ON profile."id" = media."profileId";

DROP TABLE "ProfileMedia";
ALTER TABLE "new_ProfileMedia" RENAME TO "ProfileMedia";

CREATE UNIQUE INDEX "ProfileMedia_storageKey_key" ON "ProfileMedia"("storageKey");
CREATE UNIQUE INDEX "ProfileMedia_originalStorageKey_key" ON "ProfileMedia"("originalStorageKey");
CREATE INDEX "ProfileMedia_profileId_kind_removedAt_idx" ON "ProfileMedia"("profileId", "kind", "removedAt");
CREATE INDEX "ProfileMedia_ownerAccountId_processingState_scanState_idx" ON "ProfileMedia"("ownerAccountId", "processingState", "scanState");

PRAGMA foreign_keys=ON;

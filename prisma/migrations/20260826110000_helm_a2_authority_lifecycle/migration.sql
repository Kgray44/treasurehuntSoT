ALTER TABLE "TaleSession" ADD COLUMN "captainAuthorityState" TEXT NOT NULL DEFAULT 'ASSIGNED';

CREATE INDEX "TaleSession_captainAuthorityState_status_idx"
    ON "TaleSession"("captainAuthorityState", "status");

CREATE TABLE "VoyageCaptainAuthorityReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousCaptainAccountId" TEXT,
    "nextCaptainAccountId" TEXT,
    "authorityState" TEXT NOT NULL,
    "sourceConcurrencyVersion" INTEGER NOT NULL,
    "sourceSequence" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "safeReason" TEXT,
    "committedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "VoyageCaptainAuthorityReceipt_idempotencyKey_key"
    ON "VoyageCaptainAuthorityReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "VoyageCaptainAuthorityReceipt_correlationId_key"
    ON "VoyageCaptainAuthorityReceipt"("correlationId");
CREATE INDEX "VoyageCaptainAuthorityReceipt_voyageId_committedAt_idx"
    ON "VoyageCaptainAuthorityReceipt"("voyageId", "committedAt");
CREATE INDEX "VoyageCaptainAuthorityReceipt_nextCaptainAccountId_committedAt_idx"
    ON "VoyageCaptainAuthorityReceipt"("nextCaptainAccountId", "committedAt");

CREATE TABLE "VoyageForkLineage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentVoyageId" TEXT NOT NULL,
    "childVoyageId" TEXT NOT NULL,
    "sourceConcurrencyVersion" INTEGER NOT NULL,
    "sourceSequence" INTEGER NOT NULL,
    "requesterPlayerProfileId" TEXT NOT NULL,
    "requesterAccountId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "VoyageForkLineage_childVoyageId_key"
    ON "VoyageForkLineage"("childVoyageId");
CREATE UNIQUE INDEX "VoyageForkLineage_idempotencyKey_key"
    ON "VoyageForkLineage"("idempotencyKey");
CREATE UNIQUE INDEX "VoyageForkLineage_correlationId_key"
    ON "VoyageForkLineage"("correlationId");
CREATE INDEX "VoyageForkLineage_parentVoyageId_createdAt_idx"
    ON "VoyageForkLineage"("parentVoyageId", "createdAt");
CREATE INDEX "VoyageForkLineage_requesterPlayerProfileId_createdAt_idx"
    ON "VoyageForkLineage"("requesterPlayerProfileId", "createdAt");

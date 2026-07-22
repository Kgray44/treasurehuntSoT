CREATE TABLE "CommunityInstallation" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "packageId" TEXT NOT NULL, "releaseId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL, "mode" TEXT NOT NULL, "installedPackageChecksum" TEXT NOT NULL, "localModificationChecksum" TEXT,
  "upstreamReleaseId" TEXT, "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityInstallation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CommunityInstallOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityInstallation_operationId_key" ON "CommunityInstallation"("operationId");
CREATE INDEX "CommunityInstallation_accountId_upstreamReleaseId_idx" ON "CommunityInstallation"("accountId", "upstreamReleaseId");
CREATE TABLE "CommunityRemixLineage" (
  "id" TEXT NOT NULL PRIMARY KEY, "derivedReleaseId" TEXT NOT NULL, "sourceReleaseId" TEXT NOT NULL, "rootReleaseId" TEXT NOT NULL,
  "sourcePackageChecksum" TEXT NOT NULL, "mode" TEXT NOT NULL, "attributionSnapshot" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityRemixLineage_derivedReleaseId_key" ON "CommunityRemixLineage"("derivedReleaseId");
CREATE INDEX "CommunityRemixLineage_sourceReleaseId_idx" ON "CommunityRemixLineage"("sourceReleaseId");
CREATE INDEX "CommunityRemixLineage_rootReleaseId_idx" ON "CommunityRemixLineage"("rootReleaseId");
CREATE TABLE "CommunityReleaseUpdate" (
  "id" TEXT NOT NULL PRIMARY KEY, "installationId" TEXT NOT NULL, "currentReleaseId" TEXT NOT NULL, "candidateReleaseId" TEXT NOT NULL,
  "comparison" TEXT NOT NULL, "localEditProtected" BOOLEAN NOT NULL DEFAULT false, "resolvedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityReleaseUpdate_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "CommunityInstallation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityReleaseUpdate_installationId_candidateReleaseId_key" ON "CommunityReleaseUpdate"("installationId", "candidateReleaseId");
CREATE INDEX "CommunityReleaseUpdate_installationId_resolvedAt_idx" ON "CommunityReleaseUpdate"("installationId", "resolvedAt");

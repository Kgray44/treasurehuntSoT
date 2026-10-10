-- CreateTable
CREATE TABLE "CrossdeckSurfaceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surfaceId" TEXT NOT NULL,
    "accountSessionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY_STORY',
    "capabilities" TEXT NOT NULL DEFAULT '{}',
    "lifecycle" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossdeckSurfaceSession_accountSessionId_fkey" FOREIGN KEY ("accountSessionId") REFERENCES "AccountSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrossdeckSurfaceSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "PlaythroughMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrossdeckPairingChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "claimedSurfaceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossdeckPairingChallenge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrossdeckSurfaceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CrossdeckSurfaceSession_surfaceId_key" ON "CrossdeckSurfaceSession"("surfaceId");

-- CreateIndex
CREATE INDEX "CrossdeckSurfaceSession_membershipId_revokedAt_expiresAt_idx" ON "CrossdeckSurfaceSession"("membershipId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "CrossdeckSurfaceSession_accountSessionId_revokedAt_idx" ON "CrossdeckSurfaceSession"("accountSessionId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrossdeckPairingChallenge_codeHash_key" ON "CrossdeckPairingChallenge"("codeHash");

-- CreateIndex
CREATE INDEX "CrossdeckPairingChallenge_sourceId_expiresAt_idx" ON "CrossdeckPairingChallenge"("sourceId", "expiresAt");


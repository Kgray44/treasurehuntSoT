CREATE TABLE "MembershipPresenceDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playthroughMembershipId" TEXT NOT NULL,
    "taleSessionId" TEXT NOT NULL,
    "deviceInstanceId" TEXT NOT NULL,
    "lastHeartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedSequence" INTEGER NOT NULL DEFAULT 0,
    "safeActivity" TEXT,
    "connectionGeneration" INTEGER NOT NULL DEFAULT 0,
    "disconnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipPresenceDevice_playthroughMembershipId_fkey" FOREIGN KEY ("playthroughMembershipId") REFERENCES "PlaythroughMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipPresenceDevice_taleSessionId_fkey" FOREIGN KEY ("taleSessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MembershipPresenceDevice_playthroughMembershipId_deviceInstanceId_key"
    ON "MembershipPresenceDevice"("playthroughMembershipId", "deviceInstanceId");
CREATE INDEX "MembershipPresenceDevice_taleSessionId_lastHeartbeatAt_idx"
    ON "MembershipPresenceDevice"("taleSessionId", "lastHeartbeatAt");
CREATE INDEX "MembershipPresenceDevice_playthroughMembershipId_lastHeartbeatAt_idx"
    ON "MembershipPresenceDevice"("playthroughMembershipId", "lastHeartbeatAt");

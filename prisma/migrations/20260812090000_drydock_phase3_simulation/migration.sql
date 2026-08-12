CREATE TABLE "DrydockScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrydockScenario_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DrydockScenarioRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioRecordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "scenarioSchemaVersion" INTEGER NOT NULL,
    "scenarioDigest" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrydockScenarioRevision_scenarioRecordId_fkey" FOREIGN KEY ("scenarioRecordId") REFERENCES "DrydockScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DrydockScenarioSuite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrydockScenarioSuite_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DrydockScenarioSuiteMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiteRecordId" TEXT NOT NULL,
    "scenarioRevisionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrydockScenarioSuiteMember_suiteRecordId_fkey" FOREIGN KEY ("suiteRecordId") REFERENCES "DrydockScenarioSuite" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrydockScenarioSuiteMember_scenarioRevisionId_fkey" FOREIGN KEY ("scenarioRevisionId") REFERENCES "DrydockScenarioRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DrydockSimulationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "scenarioRevisionId" TEXT,
    "sourceChecksum" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultDigest" TEXT,
    "coverageDigest" TEXT,
    "result" TEXT NOT NULL DEFAULT '{}',
    "trace" TEXT NOT NULL DEFAULT '[]',
    "checkpoint" TEXT NOT NULL DEFAULT '{}',
    "completedInputs" INTEGER NOT NULL DEFAULT 0,
    "cancellationRequestedAt" DATETIME,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrydockSimulationRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrydockSimulationRun_scenarioRevisionId_fkey" FOREIGN KEY ("scenarioRevisionId") REFERENCES "DrydockScenarioRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DrydockScenario_draftId_scenarioId_key" ON "DrydockScenario"("draftId", "scenarioId");
CREATE INDEX "DrydockScenario_draftId_archivedAt_updatedAt_idx" ON "DrydockScenario"("draftId", "archivedAt", "updatedAt");
CREATE UNIQUE INDEX "DrydockScenarioRevision_scenarioRecordId_revision_key" ON "DrydockScenarioRevision"("scenarioRecordId", "revision");
CREATE INDEX "DrydockScenarioRevision_sourceChecksum_createdAt_idx" ON "DrydockScenarioRevision"("sourceChecksum", "createdAt");
CREATE UNIQUE INDEX "DrydockScenarioSuite_draftId_suiteId_key" ON "DrydockScenarioSuite"("draftId", "suiteId");
CREATE INDEX "DrydockScenarioSuite_draftId_archivedAt_updatedAt_idx" ON "DrydockScenarioSuite"("draftId", "archivedAt", "updatedAt");
CREATE UNIQUE INDEX "DrydockScenarioSuiteMember_suiteRecordId_scenarioRevisionId_key" ON "DrydockScenarioSuiteMember"("suiteRecordId", "scenarioRevisionId");
CREATE UNIQUE INDEX "DrydockScenarioSuiteMember_suiteRecordId_orderIndex_key" ON "DrydockScenarioSuiteMember"("suiteRecordId", "orderIndex");
CREATE INDEX "DrydockScenarioSuiteMember_scenarioRevisionId_idx" ON "DrydockScenarioSuiteMember"("scenarioRevisionId");
CREATE UNIQUE INDEX "DrydockSimulationRun_runId_key" ON "DrydockSimulationRun"("runId");
CREATE INDEX "DrydockSimulationRun_draftId_createdAt_idx" ON "DrydockSimulationRun"("draftId", "createdAt");
CREATE INDEX "DrydockSimulationRun_sourceChecksum_status_idx" ON "DrydockSimulationRun"("sourceChecksum", "status");
CREATE INDEX "DrydockSimulationRun_scenarioRevisionId_createdAt_idx" ON "DrydockSimulationRun"("scenarioRevisionId", "createdAt");
CREATE INDEX "DrydockSimulationRun_leaseExpiresAt_idx" ON "DrydockSimulationRun"("leaseExpiresAt");

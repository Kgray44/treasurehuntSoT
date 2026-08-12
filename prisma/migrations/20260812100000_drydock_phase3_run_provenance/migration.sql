ALTER TABLE "DrydockSimulationRun" ADD COLUMN "sourceGitSha" TEXT NOT NULL DEFAULT 'UNRESOLVED';
ALTER TABLE "DrydockSimulationRun" ADD COLUMN "scenarioSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DrydockSimulationRun" ADD COLUMN "faultCatalogVersion" TEXT NOT NULL DEFAULT 'drydock-fault-catalog-v1';

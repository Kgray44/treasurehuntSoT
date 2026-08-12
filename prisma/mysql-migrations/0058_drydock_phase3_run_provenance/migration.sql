ALTER TABLE `DrydockSimulationRun`
  ADD COLUMN `sourceGitSha` VARCHAR(64) NOT NULL DEFAULT 'UNRESOLVED' AFTER `sourceRevision`,
  ADD COLUMN `scenarioSchemaVersion` INT NOT NULL DEFAULT 1 AFTER `adapterVersion`,
  ADD COLUMN `faultCatalogVersion` VARCHAR(64) NOT NULL DEFAULT 'drydock-fault-catalog-v1' AFTER `scenarioSchemaVersion`;

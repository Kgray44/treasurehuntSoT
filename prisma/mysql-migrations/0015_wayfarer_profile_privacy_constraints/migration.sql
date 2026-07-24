-- Phase 2 public projection indexes; no private field is made public by this migration.
CREATE INDEX `ExternalIdentity_public_projection_idx` ON `ExternalIdentity` (`accountId`, `status`, `visibility`, `revokedAt`);
CREATE INDEX `ProfileMedia_public_projection_idx` ON `ProfileMedia` (`profileId`, `kind`, `removedAt`);

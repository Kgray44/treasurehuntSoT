ALTER TABLE `ProviderLinkAttempt`
  MODIFY `accountId` VARCHAR(191) NULL,
  ADD COLUMN `intent` VARCHAR(32) NOT NULL DEFAULT 'LINK' AFTER `provider`;

CREATE INDEX `ProviderLinkAttempt_intent_provider_expiresAt_idx`
  ON `ProviderLinkAttempt`(`intent`, `provider`, `expiresAt`);

CREATE TABLE `PrivateContentWrappedKey` (`id` VARCHAR(191) NOT NULL, `provider` VARCHAR(64) NOT NULL, `keyVersion` VARCHAR(191) NOT NULL, `wrappedKey` LONGTEXT NOT NULL, `algorithm` VARCHAR(32) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), KEY `PrivateContentWrappedKey_provider_keyVersion_idx` (`provider`,`keyVersion`));
CREATE TABLE `PrivateContentEncryptedPayload` (`id` VARCHAR(191) NOT NULL, `objectKey` VARCHAR(255) NOT NULL, `sha256` CHAR(64) NOT NULL, `byteLength` INTEGER NOT NULL, `cipher` VARCHAR(32) NOT NULL, `wrappedKeyId` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE KEY `PrivateContentEncryptedPayload_objectKey_key` (`objectKey`), KEY `PrivateContentEncryptedPayload_wrappedKeyId_idx` (`wrappedKeyId`));

-- Concrete Phase 2 repair: new encrypted imports clear the legacy compatibility
-- payload only after verification, so the Phase 1 column must permit NULL.
ALTER TABLE `PrivateContentImport` MODIFY COLUMN `contentJson` LONGTEXT NULL;

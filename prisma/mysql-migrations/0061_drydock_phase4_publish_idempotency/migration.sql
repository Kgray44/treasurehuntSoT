ALTER TABLE `PublishedTaleVersion` ADD UNIQUE KEY `PublishedTaleVersion_taleId_checksum_key` (`taleId`, `checksum`);

CREATE TABLE `ParallaxObservation` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `receiptDigest` VARCHAR(191) NOT NULL,
  `blockId` VARCHAR(191) NOT NULL,
  `publishedVersionId` VARCHAR(191) NOT NULL,
  `evidence` LONGTEXT NOT NULL,
  `observedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`sessionId`) REFERENCES `TaleSession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`actorId`) REFERENCES `PlayerProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE UNIQUE INDEX `ParallaxObservation_sessionId_actorId_idempotencyKey_key` ON `ParallaxObservation` (`sessionId`, `actorId`, `idempotencyKey`);
CREATE INDEX `ParallaxObservation_sessionId_blockId_createdAt_idx` ON `ParallaxObservation` (`sessionId`, `blockId`, `createdAt`);

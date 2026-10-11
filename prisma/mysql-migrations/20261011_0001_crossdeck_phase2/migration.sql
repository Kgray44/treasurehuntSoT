CREATE TABLE `CrossdeckDeck` (
  `id` VARCHAR(191) NOT NULL,
  `membershipId` VARCHAR(191) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `state` LONGTEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CrossdeckDeck_membershipId_key` (`membershipId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CrossdeckDeck_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `PlaythroughMembership` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

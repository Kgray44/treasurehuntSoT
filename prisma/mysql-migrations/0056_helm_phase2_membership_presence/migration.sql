CREATE TABLE `MembershipPresenceDevice` (
    `id` VARCHAR(191) NOT NULL,
    `playthroughMembershipId` VARCHAR(191) NOT NULL,
    `taleSessionId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `lastHeartbeatAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedSequence` INTEGER NOT NULL DEFAULT 0,
    `safeActivity` VARCHAR(32) NULL,
    `connectionGeneration` INTEGER NOT NULL DEFAULT 0,
    `disconnectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `MembershipPresenceDevice_membership_device_key` (`playthroughMembershipId`, `deviceInstanceId`),
    INDEX `MembershipPresenceDevice_session_heartbeat_idx` (`taleSessionId`, `lastHeartbeatAt`),
    INDEX `MembershipPresenceDevice_membership_heartbeat_idx` (`playthroughMembershipId`, `lastHeartbeatAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `MembershipPresenceDevice_membership_fkey` FOREIGN KEY (`playthroughMembershipId`) REFERENCES `PlaythroughMembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `MembershipPresenceDevice_session_fkey` FOREIGN KEY (`taleSessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

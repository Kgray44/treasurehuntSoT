-- Item metadata/accessibility are stored with immutable package items. No
-- alternate private-asset, scanner, or storage table is created here.
CREATE INDEX "CommunityPackageItem_packageId_mediaType_idx" ON "CommunityPackageItem"("packageId", "mediaType");

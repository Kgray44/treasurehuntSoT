-- Harborlight Phase 3 collection lifecycle: no private source data or media is copied here.
ALTER TABLE "CommunityCollection" ADD COLUMN "coverReference" TEXT;
ALTER TABLE "CommunityCollection" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "CommunityCollection" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "CommunityCollection_visibility_archivedAt_deletedAt_idx" ON "CommunityCollection"("visibility", "archivedAt", "deletedAt");

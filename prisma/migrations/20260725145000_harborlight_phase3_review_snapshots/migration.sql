-- Additive review/Creator-response presentation snapshots. Nullable columns
-- preserve historical rows without fabricating an author identity.
ALTER TABLE "CommunityReview" ADD COLUMN "authorDisplayName" TEXT;
ALTER TABLE "CommunityReview" ADD COLUMN "authorHandle" TEXT;
ALTER TABLE "CommunityReview" ADD COLUMN "reviewedReleaseId" TEXT;

ALTER TABLE "CommunityCreatorResponse" ADD COLUMN "creatorDisplayName" TEXT;
ALTER TABLE "CommunityCreatorResponse" ADD COLUMN "creatorHandle" TEXT;
ALTER TABLE "CommunityCreatorResponse" ADD COLUMN "spoilerBody" TEXT;
ALTER TABLE "CommunityCreatorResponse" ADD COLUMN "spoilerLevel" TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE "CommunityComment" ADD COLUMN "authorDisplayName" TEXT;
ALTER TABLE "CommunityComment" ADD COLUMN "authorHandle" TEXT;

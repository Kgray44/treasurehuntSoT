-- CreateTable
CREATE TABLE "CommunityReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "authorAccountId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "spoilerFreeBody" TEXT,
    "spoilerBody" TEXT,
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NONE',
    "verifiedInstallation" BOOLEAN NOT NULL DEFAULT false,
    "verifiedCompletion" BOOLEAN NOT NULL DEFAULT false,
    "completionSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE INDEX "CommunityReview_listingId_status_createdAt_idx" ON "CommunityReview"("listingId", "status", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityReview_listingId_authorAccountId_key" ON "CommunityReview"("listingId", "authorAccountId");
-- CreateTable
CREATE TABLE "CommunityReviewDimension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "score" INTEGER NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityReviewDimension_reviewId_dimension_key" ON "CommunityReviewDimension"("reviewId", "dimension");
-- CreateTable
CREATE TABLE "CommunityReviewHelpfulVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityReviewHelpfulVote_reviewId_accountId_key" ON "CommunityReviewHelpfulVote"("reviewId", "accountId");
-- CreateTable
CREATE TABLE "CommunityCreatorResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "creatorAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityCreatorResponse_reviewId_key" ON "CommunityCreatorResponse"("reviewId");
-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "authorAccountId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "spoilerBody" TEXT,
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityComment_subjectType_subjectId_createdAt_idx" ON "CommunityComment"("subjectType", "subjectId", "createdAt");
-- CreateIndex
CREATE INDEX "CommunityComment_parentCommentId_idx" ON "CommunityComment"("parentCommentId");
-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reporterAccountId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityReport_subjectType_subjectId_status_idx" ON "CommunityReport"("subjectType", "subjectId", "status");

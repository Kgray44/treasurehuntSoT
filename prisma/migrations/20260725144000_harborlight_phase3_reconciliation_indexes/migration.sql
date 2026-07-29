-- CreateTable
CREATE TABLE "CommunityGuideContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerProfileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "safeSummary" TEXT NOT NULL,
    "sanitizedBody" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "deprecatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityGuideContent_slug_key" ON "CommunityGuideContent"("slug");
-- CreateIndex
CREATE INDEX "CommunityGuideContent_status_category_publishedAt_idx" ON "CommunityGuideContent"("status", "category", "publishedAt");

-- Closure migration: formalize Harborlight foreign keys and durable outbox claims.
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "claimOwner" TEXT;
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "claimExpiresAt" DATETIME;
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;
CREATE INDEX "CommunityOutboxEvent_processedAt_availableAt_claimExpiresAt_idx" ON "CommunityOutboxEvent"("processedAt", "availableAt", "claimExpiresAt");
-- The following closure migration rebuilds the additive SQLite tables with
-- explicit referential constraints; no canonical table is touched.

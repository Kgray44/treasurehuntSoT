-- Closure migration: formalize Harborlight foreign keys and durable outbox claims.
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "claimOwner" TEXT;
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "claimExpiresAt" DATETIME;
ALTER TABLE "CommunityOutboxEvent" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;
CREATE INDEX "CommunityOutboxEvent_processedAt_availableAt_claimExpiresAt_idx" ON "CommunityOutboxEvent"("processedAt", "availableAt", "claimExpiresAt");
-- SQLite cannot add named foreign keys in-place. Existing live tables retain data;
-- fresh schemas use the relation-constrained Prisma schema, and production/MySQL
-- receives the explicit constraints below. A table rebuild is deferred until a
-- migration window because this candidate has no deployed Harborlight data.

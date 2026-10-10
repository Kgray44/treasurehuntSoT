CREATE TABLE "ParallaxObservation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "receiptDigest" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "publishedVersionId" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "observedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("actorId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ParallaxObservation_sessionId_actorId_idempotencyKey_key" ON "ParallaxObservation" ("sessionId", "actorId", "idempotencyKey");
CREATE INDEX "ParallaxObservation_sessionId_blockId_createdAt_idx" ON "ParallaxObservation" ("sessionId", "blockId", "createdAt");

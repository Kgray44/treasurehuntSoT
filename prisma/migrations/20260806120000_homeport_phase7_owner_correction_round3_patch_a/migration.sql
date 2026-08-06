-- Project Homeport Phase 7 owner correction Round 3 Patch A.
-- Existing rows remain nullable so this migration never guesses how to resolve
-- a historical normalized-name collision. New account registration owns and
-- populates this key atomically.
ALTER TABLE "PlayerProfile" ADD COLUMN "normalizedDisplayName" TEXT;

CREATE UNIQUE INDEX "PlayerProfile_normalizedDisplayName_key"
ON "PlayerProfile"("normalizedDisplayName");

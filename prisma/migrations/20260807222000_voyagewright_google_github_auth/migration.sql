PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ProviderLinkAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "provider" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'LINK',
    "stateHash" TEXT NOT NULL,
    "pkceVerifier" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "redirectPath" TEXT NOT NULL DEFAULT '/passport/providers',
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderLinkAttempt_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ProviderLinkAttempt"
  ("accountId", "consumedAt", "createdAt", "expiresAt", "id", "nonceHash", "pkceVerifier", "provider", "redirectPath", "stateHash")
SELECT
  "accountId", "consumedAt", "createdAt", "expiresAt", "id", "nonceHash", "pkceVerifier", "provider", "redirectPath", "stateHash"
FROM "ProviderLinkAttempt";

DROP TABLE "ProviderLinkAttempt";
ALTER TABLE "new_ProviderLinkAttempt" RENAME TO "ProviderLinkAttempt";
CREATE UNIQUE INDEX "ProviderLinkAttempt_stateHash_key" ON "ProviderLinkAttempt"("stateHash");
CREATE INDEX "ProviderLinkAttempt_accountId_provider_expiresAt_idx"
  ON "ProviderLinkAttempt"("accountId", "provider", "expiresAt");
CREATE INDEX "ProviderLinkAttempt_intent_provider_expiresAt_idx"
  ON "ProviderLinkAttempt"("intent", "provider", "expiresAt");

PRAGMA foreign_keys=ON;

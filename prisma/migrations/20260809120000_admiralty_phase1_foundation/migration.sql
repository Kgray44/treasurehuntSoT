CREATE TABLE "PrivilegedAssurance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "accountSessionId" TEXT NOT NULL,
    "assuranceLevel" TEXT NOT NULL DEFAULT 'ADMIN_REAUTHENTICATED',
    "method" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "correlationId" TEXT NOT NULL,
    CONSTRAINT "PrivilegedAssurance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrivilegedAssurance_accountSessionId_fkey" FOREIGN KEY ("accountSessionId") REFERENCES "AccountSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PrivilegedAssurance_accountId_accountSessionId_expiresAt_revokedAt_idx"
    ON "PrivilegedAssurance"("accountId", "accountSessionId", "expiresAt", "revokedAt");
CREATE INDEX "PrivilegedAssurance_correlationId_idx" ON "PrivilegedAssurance"("correlationId");

CREATE TABLE "SupportAccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestingAdminAccountId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requestedScopes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "decisionAt" DATETIME,
    "decisionByTargetAccountId" TEXT,
    "cancelledAt" DATETIME,
    "correlationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportAccessRequest_requestingAdminAccountId_fkey" FOREIGN KEY ("requestingAdminAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAccessRequest_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAccessRequest_decisionByTargetAccountId_fkey" FOREIGN KEY ("decisionByTargetAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SupportAccessRequest_correlationId_key" ON "SupportAccessRequest"("correlationId");
CREATE INDEX "SupportAccessRequest_targetAccountId_status_expiresAt_idx"
    ON "SupportAccessRequest"("targetAccountId", "status", "expiresAt");
CREATE INDEX "SupportAccessRequest_requestingAdminAccountId_status_expiresAt_idx"
    ON "SupportAccessRequest"("requestingAdminAccountId", "status", "expiresAt");

CREATE TABLE "SupportAccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "operatorAccountId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "grantedScopes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokedByAccountId" TEXT,
    "revocationReason" TEXT,
    "correlationId" TEXT NOT NULL,
    CONSTRAINT "SupportAccessGrant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportAccessRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAccessGrant_operatorAccountId_fkey" FOREIGN KEY ("operatorAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAccessGrant_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAccessGrant_revokedByAccountId_fkey" FOREIGN KEY ("revokedByAccountId") REFERENCES "UserAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SupportAccessGrant_requestId_key" ON "SupportAccessGrant"("requestId");
CREATE INDEX "SupportAccessGrant_operatorAccountId_status_expiresAt_idx"
    ON "SupportAccessGrant"("operatorAccountId", "status", "expiresAt");
CREATE INDEX "SupportAccessGrant_targetAccountId_status_expiresAt_idx"
    ON "SupportAccessGrant"("targetAccountId", "status", "expiresAt");
CREATE INDEX "SupportAccessGrant_correlationId_idx" ON "SupportAccessGrant"("correlationId");

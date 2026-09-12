CREATE TABLE "VoyageCrewMessage" (
 "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
 "voyageId" TEXT NOT NULL,
 "senderAccountId" TEXT NOT NULL,
 "senderName" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "clientMessageId" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "VoyageCrewMessage_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "VoyageCrewMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VoyageCrewMessage_voyageId_senderAccountId_clientMessageId_key" ON "VoyageCrewMessage"("voyageId", "senderAccountId", "clientMessageId");
CREATE INDEX "VoyageCrewMessage_voyageId_id_idx" ON "VoyageCrewMessage"("voyageId", "id");
CREATE INDEX "VoyageCrewMessage_voyageId_senderAccountId_createdAt_idx" ON "VoyageCrewMessage"("voyageId", "senderAccountId", "createdAt");

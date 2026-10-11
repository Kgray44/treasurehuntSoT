CREATE TABLE "CrossdeckDeck" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "membershipId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "state" TEXT NOT NULL DEFAULT '{}',
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrossdeckDeck_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "PlaythroughMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CrossdeckDeck_membershipId_key" ON "CrossdeckDeck"("membershipId");

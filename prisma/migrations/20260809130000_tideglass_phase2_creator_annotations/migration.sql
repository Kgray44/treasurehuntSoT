CREATE TABLE "TideglassCreatorAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annotationKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "chronicleId" TEXT NOT NULL,
    "sourceEditionId" TEXT NOT NULL,
    "sourceEditionChecksum" TEXT NOT NULL,
    "targetEditionId" TEXT NOT NULL,
    "targetEditionChecksum" TEXT NOT NULL,
    "comparisonPolicyVersion" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "category" TEXT,
    "changeRecordId" TEXT,
    "annotationKind" TEXT NOT NULL,
    "headline" TEXT,
    "body" TEXT,
    "spoilerLevel" TEXT NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "replayGuidance" TEXT NOT NULL DEFAULT 'NO_RECOMMENDATION',
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesAnnotationId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT,
    CONSTRAINT "TideglassCreatorAnnotation_chronicleId_fkey" FOREIGN KEY ("chronicleId") REFERENCES "Chronicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TideglassCreatorAnnotation_sourceEditionId_fkey" FOREIGN KEY ("sourceEditionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TideglassCreatorAnnotation_targetEditionId_fkey" FOREIGN KEY ("targetEditionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TideglassCreatorAnnotation_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TideglassCreatorAnnotation_supersedesAnnotationId_fkey" FOREIGN KEY ("supersedesAnnotationId") REFERENCES "TideglassCreatorAnnotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TideglassCreatorAnnotation_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "TideglassCreatorAnnotation_scope_check" CHECK (
      ("scopeType" = 'PAIR' AND "category" IS NULL AND "changeRecordId" IS NULL) OR
      ("scopeType" = 'CATEGORY' AND "category" IS NOT NULL AND "changeRecordId" IS NULL) OR
      ("scopeType" = 'CHANGE' AND "category" IS NULL AND "changeRecordId" IS NOT NULL)
    ),
    CONSTRAINT "TideglassCreatorAnnotation_state_check" CHECK ("state" IN ('ACTIVE', 'WITHDRAWN')),
    CONSTRAINT "TideglassCreatorAnnotation_kind_check" CHECK ("annotationKind" IN ('HEADLINE', 'DETAIL', 'COMPATIBILITY', 'LIMITATION', 'REPLAY_GUIDANCE')),
    CONSTRAINT "TideglassCreatorAnnotation_spoiler_check" CHECK ("spoilerLevel" IN ('PREVIEW_SAFE', 'STORY_SPOILER', 'ENDING_SPOILER', 'CREATOR_ONLY', 'CAPTAIN_ONLY', 'PRIVATE_OR_REDACTED')),
    CONSTRAINT "TideglassCreatorAnnotation_replay_check" CHECK ("replayGuidance" IN ('NO_RECOMMENDATION', 'MINOR_UPDATE', 'WORTH_REVISITING', 'SUBSTANTIAL_NEW_CONTENT'))
);

CREATE UNIQUE INDEX "TideglassCreatorAnnotation_supersedesAnnotationId_key" ON "TideglassCreatorAnnotation"("supersedesAnnotationId");
CREATE UNIQUE INDEX "TideglassCreatorAnnotation_annotationKey_revision_key" ON "TideglassCreatorAnnotation"("annotationKey", "revision");
CREATE UNIQUE INDEX "TideglassCreatorAnnotation_author_idempotency_key" ON "TideglassCreatorAnnotation"("createdByAccountId", "idempotencyKey");
CREATE INDEX "TideglassCreatorAnnotation_pair_created_idx" ON "TideglassCreatorAnnotation"("chronicleId", "sourceEditionId", "targetEditionId", "createdAt");
CREATE INDEX "TideglassCreatorAnnotation_changeRecordId_idx" ON "TideglassCreatorAnnotation"("changeRecordId");
CREATE INDEX "TideglassCreatorAnnotation_author_created_idx" ON "TideglassCreatorAnnotation"("createdByAccountId", "createdAt");

-- Phase 3 repair actions retain a non-sensitive reason code for exact execution policy.
ALTER TABLE "PrivateRepairAction" ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'REVIEW';

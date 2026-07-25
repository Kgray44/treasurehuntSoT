import { db } from "@/lib/db";

import type { CanonicalCompletedTaleSession, CreateKeepsakeRecord, KeepsakeStore, PrivateVoyageKeepsake } from "./keepsakes";

type CompletedSessionWithTitle = CanonicalCompletedTaleSession & { taleTitle: string };
const keepsakeDb = db as any;

/**
 * Database adapter for the immutable, completion-derived Keepsake record.
 * It only reads the minimal canonical facts needed for eligibility and writes
 * CommunityVoyageKeepsake; it has no mutation path to Tale Session state.
 */
export async function findCompletedSessionForOwner(
  sessionId: string,
  ownerAccountId: string,
): Promise<CompletedSessionWithTitle | null> {
    const session = await keepsakeDb.taleSession.findFirst({
      where: {
        id: sessionId,
        status: "COMPLETED",
        completedAt: { not: null },
        previewMode: false,
        publishedVersionId: { not: null },
        memberships: {
          some: {
            completedAt: { not: null },
            removedAt: null,
            player: { accountId: ownerAccountId, status: "ACTIVE" },
          },
        },
      },
      select: {
        id: true,
        taleId: true,
        publishedVersionId: true,
        status: true,
        completedAt: true,
        previewMode: true,
        tale: { select: { title: true } },
      },
    });
    return session
      ? {
          id: session.id,
          taleId: session.taleId,
          publishedVersionId: session.publishedVersionId,
          status: session.status,
          completedAt: session.completedAt,
          previewMode: session.previewMode,
          taleTitle: session.tale.title,
        }
      : null;
}

export const databaseKeepsakeStore: KeepsakeStore = {
  findCompletedSessionForOwner,
  async createKeepsakeIfMissing(input: CreateKeepsakeRecord) {
    const existing = await keepsakeDb.communityVoyageKeepsake.findUnique({
      where: { ownerAccountId_taleSessionId: { ownerAccountId: input.ownerAccountId, taleSessionId: input.taleSessionId } },
    });
    if (existing) return { keepsake: existing as PrivateVoyageKeepsake, created: false };
    try {
      const keepsake = await keepsakeDb.communityVoyageKeepsake.create({ data: input });
      return { keepsake: keepsake as PrivateVoyageKeepsake, created: true };
    } catch (cause: any) {
      if (cause?.code !== "P2002") throw cause;
      const concurrent = await keepsakeDb.communityVoyageKeepsake.findUnique({
        where: { ownerAccountId_taleSessionId: { ownerAccountId: input.ownerAccountId, taleSessionId: input.taleSessionId } },
      });
      if (!concurrent) throw cause;
      return { keepsake: concurrent as PrivateVoyageKeepsake, created: false };
    }
  },
};

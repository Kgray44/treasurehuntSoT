import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import type {
  HarborlightSharingPreparation,
  HarborlightSharingPreparationRecord,
  HarborlightSharingPreparationStore,
} from "./wayfarer-keepsake-source";

const preparationSelect = {
  id: true,
  ownerAccountId: true,
  wayfarerKeepsakeId: true,
  sourceWatermark: true,
  sourceProjectionChecksum: true,
  preparationState: true,
  safeSnapshot: true,
  representationChecksum: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CommunityVoyageKeepsakeSelect;

/** Stores only Harborlight public-sharing preparation provenance. */
export const databaseKeepsakeStore: HarborlightSharingPreparationStore = {
  async createIfMissing(input: HarborlightSharingPreparation) {
    const existing = await db.communityVoyageKeepsake.findUnique({
      where: {
        ownerAccountId_wayfarerKeepsakeId: {
          ownerAccountId: input.ownerAccountId,
          wayfarerKeepsakeId: input.sourceKeepsakeId,
        },
      },
      select: preparationSelect,
    });
    if (existing) return { record: existing satisfies HarborlightSharingPreparationRecord, created: false };
    try {
      const record = await db.communityVoyageKeepsake.create({
        data: {
          ownerAccountId: input.ownerAccountId,
          wayfarerKeepsakeId: input.sourceKeepsakeId,
          sourceWatermark: input.sourceWatermark,
          sourceProjectionChecksum: input.sourceProjectionChecksum,
          preparationState: "DRAFT_CREATED",
          publishedVersionId: input.publishedVersionId,
          safeSnapshot: input.safeSnapshot,
          representationChecksum: input.representationChecksum,
          status: "READY",
        },
        select: preparationSelect,
      });
      return { record: record satisfies HarborlightSharingPreparationRecord, created: true };
    } catch (cause) {
      if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== "P2002") throw cause;
      const concurrent = await db.communityVoyageKeepsake.findUnique({
        where: {
          ownerAccountId_wayfarerKeepsakeId: {
            ownerAccountId: input.ownerAccountId,
            wayfarerKeepsakeId: input.sourceKeepsakeId,
          },
        },
        select: preparationSelect,
      });
      if (!concurrent) throw cause;
      return { record: concurrent satisfies HarborlightSharingPreparationRecord, created: false };
    }
  },
};

import type { Prisma } from "@prisma/client";
import { CommunityError } from "./domain";

type CommunityIdentityClient = Pick<Prisma.TransactionClient, "communityProfile" | "playerProfile">;

/**
 * Harborlight keeps a private compatibility projection for Community ownership
 * and moderation. The public PlayerProfile is the only user-facing Profile.
 */
export async function resolvePublicProfileProjection(client: CommunityIdentityClient, accountId: string) {
  const canonical = await client.playerProfile.findUnique({
    where: { accountId },
    select: {
      accountId: true,
      displayName: true,
      handle: true,
      normalizedHandle: true,
      biography: true,
      defaultVisibility: true,
      status: true,
    },
  });
  if (
    !canonical?.accountId ||
    canonical.status !== "ACTIVE" ||
    !canonical.handle ||
    !canonical.normalizedHandle ||
    canonical.defaultVisibility !== "PUBLIC"
  )
    throw new CommunityError(
      "COMMUNITY_PROFILE_REQUIRED",
      "Set up an active public Profile before using this Community feature.",
    );

  const existing = await client.communityProfile.findUnique({ where: { accountId } });
  const projectionData = {
    handle: canonical.handle,
    normalizedHandle: canonical.normalizedHandle,
    displayName: canonical.displayName,
    biography: canonical.biography,
    visibility: "COMMUNITY",
  };
  try {
    return existing
      ? await client.communityProfile.update({ where: { id: existing.id }, data: projectionData })
      : await client.communityProfile.create({ data: { accountId, ...projectionData } });
  } catch (cause) {
    if ((cause as { code?: string })?.code === "P2002")
      throw new CommunityError(
        "COMMUNITY_PROFILE_CONFLICT",
        "That public Profile handle is already connected to another Community identity.",
      );
    throw cause;
  }
}

import { db } from "@/lib/db";
import { requireGmCapability } from "@/lib/security";
import { authorizeTaleSessionPlayer } from "@/platform/auth";

export type AuthenticatedActor = { id: string; kind: "CREATOR" | "PLAYER" | "CAPTAIN" };
export interface PrivateContentAuthorization {
  canAdministerPackages(): Promise<AuthenticatedActor | null>;
  canReadPrivateAsset(input: { assetId: string; playthroughId?: string | null }): Promise<boolean>;
}

export const privateContentAuthorization: PrivateContentAuthorization = {
  async canAdministerPackages() {
    const session = await requireGmCapability("CREATE_TALES");
    return session ? { id: session.userId, kind: "CREATOR" } : null;
  },
  async canReadPrivateAsset({ assetId, playthroughId }) {
    const creator = await requireGmCapability("CREATE_TALES");
    // Capability proves the actor may create Tales; it does not make every
    // Creator's sealed assets readable. Imported legacy actors and canonical
    // account owners are both checked while Phase 1 rows remain supported.
    if (creator)
      return Boolean(
        await db.privateAssetReference.findFirst({
          where: {
            id: assetId,
            available: true,
            OR: [{ ownerActorId: creator.userId }, { ownerAccountId: creator.userId }],
          },
        }),
      );
    const resolvedPlaythroughId = playthroughId ?? undefined;
    const player = resolvedPlaythroughId ? await authorizeTaleSessionPlayer(resolvedPlaythroughId) : null;
    // A legacy session token can open the legacy experience, but is not enough
    // to disclose a sealed asset: Phase 2 delivery is profile-membership and
    // canonical-reveal scoped.
    if (!player || player.kind !== "identity") return false;
    const reference = await db.privateAssetReference.findFirst({
      where: { id: assetId, available: true, revealState: "REVEALED", playthroughId: resolvedPlaythroughId },
      include: { session: true },
    });
    if (!reference?.session || !reference.taleId || reference.session.taleId !== reference.taleId) return false;
    // A playthrough is pinned to a published version when it is eligible for
    // Player delivery.  The reference is session-scoped, so a caller cannot
    // substitute a different version or playthrough in the query string.
    if (!reference.session.publishedVersionId || reference.session.status !== "ACTIVE") return false;
    return Boolean(
      await db.revealState.findFirst({
        where: {
          playthroughId: resolvedPlaythroughId,
          status: "REVEALED",
          contentType: { in: ["PRIVATE_ASSET", "TALE_ASSET"] },
          contentKey: { in: [reference.id, reference.logicalId] },
        },
        select: { id: true },
      }),
    );
  },
};

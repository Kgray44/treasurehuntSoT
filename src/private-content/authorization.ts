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
    if (!playthroughId || !(await authorizeTaleSessionPlayer(playthroughId))) return false;
    return Boolean(
      await db.privateAssetReference.findFirst({
        where: { id: assetId, available: true, revealState: "REVEALED", playthroughId },
      }),
    );
  },
};

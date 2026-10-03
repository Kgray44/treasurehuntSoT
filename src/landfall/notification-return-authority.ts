import { requirePlayerIdentity, playerCanAccessPlaythrough } from "@/platform/auth";
import { db } from "@/lib/db";
import { readLandfallReturnHandle } from "@/landfall/notification-return-server";
import { resolveLandfallNotificationReturn } from "@/landfall/background-navigation";

export async function resolveAuthenticatedLandfallReturn(handle: string) {
  const identity = await requirePlayerIdentity();
  if (!identity) return { destination: "/player/sign-in", state: "SIGN_IN" as const };
  try {
    const claim = readLandfallReturnHandle(handle);
    if (claim.scope.playerProfileId !== identity.playerProfileId)
      return { destination: "/player", state: "UNAVAILABLE" as const };
    return resolveLandfallNotificationReturn(
      { version: 1, id: "native-return", returnHandle: handle, issuedAt: claim.issuedAt, expiresAt: claim.expiresAt },
      async () => {
        const member = await playerCanAccessPlaythrough(claim.scope.sessionId, identity.playerProfileId);
        if (!member) return null;
        const session = await db.taleSession.findUnique({
          where: { id: claim.scope.sessionId },
          select: { id: true, status: true, publishedVersionId: true },
        });
        if (!session || session.publishedVersionId !== claim.scope.publishedVersionId) return null;
        return {
          signedIn: true,
          membershipActive: true,
          sessionId: session.id,
          publishedVersionId: session.publishedVersionId,
          status: session.status === "ACTIVE" ? "ACTIVE" : session.status === "COMPLETED" ? "COMPLETED" : "UNAVAILABLE",
        };
      },
    );
  } catch {
    return { destination: "/player", state: "EXPIRED" as const };
  }
}

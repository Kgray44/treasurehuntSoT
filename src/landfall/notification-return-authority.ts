import { requirePlayerIdentity, playerCanAccessPlaythrough } from "@/platform/auth";
import { cookies } from "next/headers";
import { currentAccount } from "@/wayfarer/accounts";
import { db } from "@/lib/db";
import { readLandfallReturnHandle } from "@/landfall/notification-return-server";
import { resolveLandfallNotificationReturn } from "@/landfall/background-navigation";
import {
  recordLandfallOperation,
  landfallDurationBand,
  type LandfallOperationalOutcome,
} from "./operational-observability";

export async function resolveAuthenticatedLandfallReturn(handle: string) {
  const start = performance.now();
  let outcome: LandfallOperationalOutcome = "FAILED";
  let authorizationCookie: "ABSENT" | "PRESENT" | undefined;
  let authorizationSession: "EMPTY" | "INELIGIBLE" | "PROFILE_INACTIVE" | "ELIGIBLE_ON_RECHECK" | undefined;
  try {
    const result = await resolveReturn(handle);
    if (result.state === "SIGN_IN") {
      try {
        const jar = await cookies();
        authorizationCookie = jar.has("wayfarer_account") ? "PRESENT" : "ABSENT";
        // Only the owned native lab asks the existing read-only canonical query
        // to diagnose the actual request. No credential/hash/identity is exported,
        // and the original authorization result remains authoritative.
        if (process.env.LANDFALL_NATIVE_RETURN_OBSERVATION_PATH && process.env.NODE_ENV === "production") {
          const token = jar.get("wayfarer_account")?.value;
          const session = token ? await currentAccount(token) : null;
          authorizationSession = !token
            ? "EMPTY"
            : !session
              ? "INELIGIBLE"
              : session.account.profile?.status !== "ACTIVE"
                ? "PROFILE_INACTIVE"
                : "ELIGIBLE_ON_RECHECK";
        }
      } catch {
        // Diagnostic availability cannot alter the authorization result.
      }
    }
    outcome =
      result.state === "SIGN_IN"
        ? "DENIED"
        : result.state === "UNAVAILABLE"
          ? "UNAVAILABLE"
          : result.state === "EXPIRED"
            ? "EXPIRED"
            : "RETURNED";
    return result;
  } finally {
    recordLandfallOperation({
      operation: "NOTIFICATION_RETURN",
      outcome,
      durationBand: landfallDurationBand(performance.now() - start),
      count: 1,
      ...(authorizationCookie === undefined ? {} : { authorizationCookie }),
      ...(authorizationSession === undefined ? {} : { authorizationSession }),
    });
  }
}
async function resolveReturn(handle: string) {
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

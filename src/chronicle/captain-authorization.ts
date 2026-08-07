import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";

export type CanonicalCaptainActor = Readonly<{
  accountId: string;
  legacyGameMasterId: string | null;
}>;

export function captainAuthorityClauses(actor: CanonicalCaptainActor) {
  return [
    { captainAccountId: actor.accountId },
    { captainId: actor.accountId },
    ...(actor.legacyGameMasterId ? [{ captainId: actor.legacyGameMasterId }] : []),
  ];
}

export function hasCaptainAuthority(
  resource: { captainId: string | null; captainAccountId: string | null },
  actor: CanonicalCaptainActor,
) {
  if (resource.captainAccountId) return resource.captainAccountId === actor.accountId;
  return Boolean(
    resource.captainId && (resource.captainId === actor.accountId || resource.captainId === actor.legacyGameMasterId),
  );
}

export async function requireCaptainWorkspace() {
  const session = await requireWayfarerAccount();
  if (!session) return null;
  const overview = await workspaceCapabilityOverview(session.accountId);
  return overview.workspaces.some((workspace) => workspace.id === "CAPTAIN" && workspace.state === "ACTIVE")
    ? session
    : null;
}

export async function requireCaptainSession(sessionId: string) {
  const session = await requireCaptainWorkspace();
  if (!session) return null;
  const actor = {
    accountId: session.accountId,
    legacyGameMasterId: session.account.legacyGameMasterId,
  };
  const playthrough = await db.taleSession.findFirst({
    where: { id: sessionId, OR: captainAuthorityClauses(actor) },
  });
  return playthrough ? { session, actor, playthrough } : null;
}

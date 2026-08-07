import { db } from "@/lib/db";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function requireStudioWorkspace(request?: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return null;
  const overview = await workspaceCapabilityOverview(session.accountId);
  const creator = overview.workspaces.find((workspace) => workspace.id === "CREATOR");
  return creator?.state === "ACTIVE" ? session : null;
}

export async function requireOwnedStudioTale(taleId: string, request?: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session) return null;
  const administrator = session.account.roles.some((assignment) => assignment.role === "ADMINISTRATOR");
  const collaborator = session.account.roles.some(
    (assignment) =>
      assignment.role === "CREATOR" &&
      ["CHRONICLE", "TALE"].includes(assignment.scopeType) &&
      assignment.scopeId === taleId,
  );
  const legacyCreatorId = session.account.legacyGameMasterId;
  const tale = await db.chronicle.findFirst({
    where: {
      id: taleId,
      ...(administrator || collaborator
        ? {}
        : {
            OR: [
              { creatorAccountId: session.accountId },
              { creatorId: session.accountId },
              ...(legacyCreatorId ? [{ creatorId: legacyCreatorId }] : []),
            ],
          }),
    },
    select: { id: true, creatorId: true, creatorAccountId: true },
  });
  return tale ? { session, tale } : null;
}

export async function requireOwnedStudioAsset(assetId: string, request?: Request) {
  const asset = await db.taleAsset.findUnique({ where: { id: assetId }, select: { id: true, taleId: true } });
  if (!asset) return null;
  const authorization = await requireOwnedStudioTale(asset.taleId, request);
  return authorization ? { ...authorization, asset } : null;
}

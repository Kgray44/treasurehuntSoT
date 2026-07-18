export type PlatformPrincipal =
  | { kind: "anonymous" }
  | { kind: "player"; playerId: string }
  | { kind: "staff"; accountId: string; capabilities: string[] };

export type PlatformResource = {
  ownerPlayerId?: string | null;
  memberPlayerIds?: string[];
  assignedCaptainId?: string | null;
  creatorId?: string | null;
  previewMode?: boolean;
};

export type PlatformAction =
  | "PLAYER_LIBRARY_VIEW"
  | "PLAYTHROUGH_VIEW"
  | "PLAYTHROUGH_OPERATE_PLAYER"
  | "PLAYTHROUGH_ARCHIVE_VIEW"
  | "CAPTAIN_LIBRARY_VIEW"
  | "PLAYTHROUGH_OPERATE_CAPTAIN"
  | "INVITATION_MANAGE"
  | "STUDIO_VIEW"
  | "STUDIO_EDIT"
  | "STUDIO_PUBLISH"
  | "ASSET_VIEW_PLAYER"
  | "ASSET_MANAGE";

export function authorizePlatform(
  principal: PlatformPrincipal,
  action: PlatformAction,
  resource: PlatformResource = {},
) {
  if (principal.kind === "anonymous") return false;
  if (principal.kind === "player") {
    const member =
      resource.memberPlayerIds?.includes(principal.playerId) || resource.ownerPlayerId === principal.playerId;
    return ["PLAYER_LIBRARY_VIEW", "PLAYTHROUGH_VIEW", "PLAYTHROUGH_OPERATE_PLAYER", "ASSET_VIEW_PLAYER"].includes(
      action,
    )
      ? action === "PLAYER_LIBRARY_VIEW" || Boolean(member)
      : action === "PLAYTHROUGH_ARCHIVE_VIEW" && Boolean(member);
  }
  const has = (capability: string) => principal.capabilities.includes(capability);
  if (action === "CAPTAIN_LIBRARY_VIEW") return has("CAPTAIN");
  if (["PLAYTHROUGH_OPERATE_CAPTAIN", "INVITATION_MANAGE"].includes(action))
    return has("CAPTAIN") && (!resource.assignedCaptainId || resource.assignedCaptainId === principal.accountId);
  if (["STUDIO_VIEW", "STUDIO_EDIT"].includes(action))
    return has("CREATE_TALES") && (!resource.creatorId || resource.creatorId === principal.accountId || has("ADMIN"));
  if (action === "STUDIO_PUBLISH")
    return has("PUBLISH_TALES") && (!resource.creatorId || resource.creatorId === principal.accountId || has("ADMIN"));
  if (action === "ASSET_MANAGE") return has("MANAGE_ASSETS");
  return false;
}

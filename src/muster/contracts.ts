export const MUSTER_COVER_FALLBACK = "/images/muster/moonlit-island.png";
export const MUSTER_MESSAGE_LIMIT = 1000;
export const MUSTER_HISTORY_LIMIT = 100;
export type MusterMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isCaptain: boolean;
  isCurrentPlayer: boolean;
  participates: boolean;
  status: string;
  ready: boolean;
  presence: string;
  canReceiveCaptaincy: boolean;
  invitation: { id: string; canManage: boolean } | null;
};
export type MusterMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  displayName: string;
  avatarUrl: string | null;
};
export type MusterProjection = {
  csrfToken: string;
  voyage: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    voyageName: string;
    edition: string;
    status: string;
    authorityState: string;
    captainName: string;
    duration: number | null;
    coverUrl: string;
    concurrencyVersion: number;
    currentSequence: number;
    plannedStartAt: string | null;
  };
  viewer: {
    isCaptain: boolean;
    participates: boolean;
    membershipId: string | null;
    ready: boolean;
    canLaunch: boolean;
    canRelinquish: boolean;
    canInvite: boolean;
    canLeave: boolean;
    canTakeCaptaincy: boolean;
    canContinueSolo: boolean;
    runtimeHref: string | null;
  };
  readiness: { ready: number; total: number; allReady: boolean };
  crew: MusterMember[];
};

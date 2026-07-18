export const PLAYTHROUGH_STATES = [
  "DRAFT_SETUP",
  "INVITING",
  "READY",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "ABANDONED",
] as const;

export type PlaythroughState = (typeof PLAYTHROUGH_STATES)[number];

const playthroughTransitions: Record<PlaythroughState, PlaythroughState[]> = {
  DRAFT_SETUP: ["INVITING", "CANCELLED"],
  INVITING: ["READY", "SCHEDULED", "CANCELLED"],
  READY: ["SCHEDULED", "ACTIVE", "CANCELLED"],
  SCHEDULED: ["READY", "ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "ABANDONED"],
  PAUSED: ["ACTIVE", "COMPLETED", "ABANDONED"],
  COMPLETED: [],
  CANCELLED: [],
  ABANDONED: [],
};

export const MEMBERSHIP_STATES = [
  "INVITED",
  "ACCEPTED",
  "READY",
  "ACTIVE_MEMBER",
  "COMPLETED_MEMBER",
  "DECLINED",
  "REMOVED",
  "SUSPENDED",
] as const;

export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

const membershipTransitions: Record<MembershipState, MembershipState[]> = {
  INVITED: ["ACCEPTED", "DECLINED", "REMOVED", "SUSPENDED"],
  ACCEPTED: ["READY", "REMOVED", "SUSPENDED"],
  READY: ["ACTIVE_MEMBER", "REMOVED", "SUSPENDED"],
  ACTIVE_MEMBER: ["COMPLETED_MEMBER", "REMOVED", "SUSPENDED"],
  COMPLETED_MEMBER: [],
  DECLINED: [],
  REMOVED: [],
  SUSPENDED: ["READY", "ACTIVE_MEMBER", "REMOVED"],
};

export const INVITATION_STATES = [
  "CREATED",
  "SENT",
  "COPIED",
  "VIEWED",
  "ACCEPTED",
  "JOINED",
  "READY",
  "CONSUMED",
  "DECLINED",
  "EXPIRED",
  "REVOKED",
  "REPLACED",
] as const;

export type InvitationState = (typeof INVITATION_STATES)[number];

export function canTransitionPlaythrough(from: string, to: PlaythroughState) {
  return PLAYTHROUGH_STATES.includes(from as PlaythroughState)
    ? playthroughTransitions[from as PlaythroughState].includes(to)
    : false;
}

export function canTransitionMembership(from: string, to: MembershipState) {
  return MEMBERSHIP_STATES.includes(from as MembershipState)
    ? membershipTransitions[from as MembershipState].includes(to)
    : false;
}

export function assertPlaythroughTransition(from: string, to: PlaythroughState) {
  if (!canTransitionPlaythrough(from, to)) throw new Error(`A playthrough cannot transition from ${from} to ${to}.`);
}

export function assertMembershipTransition(from: string, to: MembershipState) {
  if (!canTransitionMembership(from, to)) throw new Error(`A membership cannot transition from ${from} to ${to}.`);
}

export function invitationUsable(status: string, expiresAt: Date, redemptionCount: number, maxRedemptions: number) {
  return (
    ["CREATED", "SENT", "COPIED", "VIEWED"].includes(status) &&
    expiresAt.getTime() > Date.now() &&
    redemptionCount < maxRedemptions
  );
}

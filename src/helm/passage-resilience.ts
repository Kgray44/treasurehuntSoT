export const helmPreflightStates = ["READY", "READY_WITH_WARNINGS", "NOT_READY", "UNKNOWN_DEPENDENCY"] as const;
export type HelmPreflightState = (typeof helmPreflightStates)[number];

export type HelmPreflightCheck = Readonly<{
  id: "EDITION" | "CREW" | "LIFECYCLE" | "PRESENTATION" | "PROVIDER";
  state: "PASS" | "WARNING" | "BLOCKED" | "UNKNOWN";
  label: string;
  detail: string;
  source: string;
}>;

export type HelmRecoveryStep = Readonly<{
  id: "REFRESH" | "PAUSE" | "RESUME" | "REPLAY_PRESENTATION" | "RESTORE_PRIOR_PASSAGE" | "ESCALATE";
  label: string;
  detail: string;
  commandId: "PAUSE_VOYAGE" | "RESUME_VOYAGE" | "REPLAY_PRESENTATION" | "RESTORE_PRIOR_PASSAGE" | null;
}>;

export type HelmPassageResilienceProjection = Readonly<{
  preflight: { state: HelmPreflightState; checks: HelmPreflightCheck[] };
  recovery: {
    state: "HEALTHY" | "ACTIONABLE" | "ESCALATE";
    diagnosis: string;
    evidence: { sourceRevision: number; observedAt: string };
    steps: HelmRecoveryStep[];
  };
}>;

type Attention = Readonly<{ category: string; severity: string; title: string }>;

export function deriveHelmPassageResilience(input: {
  lifecycle: string;
  hasPublishedEdition: boolean;
  memberCount: number;
  readyMemberCount: number;
  presentationProvider: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  attention: readonly Attention[];
  hasPriorPassage: boolean;
  currentSequence: number;
  observedAt: Date;
}): HelmPassageResilienceProjection {
  const checks: HelmPreflightCheck[] = [
    input.hasPublishedEdition
      ? {
          id: "EDITION",
          state: "PASS",
          label: "Published edition",
          detail: "A canonical published edition is attached to this Voyage.",
          source: "PublishedTaleVersion",
        }
      : {
          id: "EDITION",
          state: "BLOCKED",
          label: "Published edition",
          detail: "This Voyage has no canonical published edition to launch.",
          source: "TaleSession",
        },
    input.memberCount === 0 || input.readyMemberCount > 0
      ? {
          id: "CREW",
          state: "PASS",
          label: "Crew readiness",
          detail:
            input.memberCount === 0
              ? "Captain-only Voyage; no Player readiness evidence is required."
              : "At least one accepted Player is ready under the current Captain authority rules.",
          source: "PlaythroughMembership",
        }
      : {
          id: "CREW",
          state: "BLOCKED",
          label: "Crew readiness",
          detail: "No accepted Player is ready; launch remains unavailable.",
          source: "PlaythroughMembership",
        },
    ["READY", "SCHEDULED"].includes(input.lifecycle)
      ? {
          id: "LIFECYCLE",
          state: "PASS",
          label: "Voyage lifecycle",
          detail: "The current lifecycle permits the existing governed launch path.",
          source: "TaleSession",
        }
      : {
          id: "LIFECYCLE",
          state: "BLOCKED",
          label: "Voyage lifecycle",
          detail: `The Voyage is ${input.lifecycle.toLocaleLowerCase().replaceAll("_", " ")}; it cannot launch now.`,
          source: "TaleSession",
        },
  ];

  if (input.presentationProvider === "AVAILABLE")
    checks.push({
      id: "PRESENTATION",
      state: "PASS",
      label: "Presentation provider",
      detail: "Current presentation readiness is available from its owning provider.",
      source: "PresentationProvider",
    });
  else if (input.presentationProvider === "UNAVAILABLE")
    checks.push({
      id: "PRESENTATION",
      state: "WARNING",
      label: "Presentation provider",
      detail: "Presentation readiness is unavailable. Helm has not treated the provider as healthy.",
      source: "PresentationProvider",
    });
  else
    checks.push({
      id: "PROVIDER",
      state: "UNKNOWN",
      label: "Adjacent provider readiness",
      detail: "No provider-neutral readiness contract is available for this Voyage; no provider result is assumed.",
      source: "HelmProviderContract",
    });

  const preflightState: HelmPreflightState = checks.some((check) => check.state === "BLOCKED")
    ? "NOT_READY"
    : checks.some((check) => check.state === "UNKNOWN")
      ? "UNKNOWN_DEPENDENCY"
      : checks.some((check) => check.state === "WARNING")
        ? "READY_WITH_WARNINGS"
        : "READY";

  const degraded = input.attention.filter((item) => ["CONNECTION", "SYSTEM"].includes(item.category));
  const critical = input.attention.some((item) => item.severity === "CRITICAL");
  const steps: HelmRecoveryStep[] = [
    {
      id: "REFRESH",
      label: "Refresh authoritative state",
      detail: "Re-read the current Voyage projection before choosing a recovery action.",
      commandId: null,
    },
  ];
  if (input.lifecycle === "ACTIVE" && degraded.length)
    steps.push({
      id: "PAUSE",
      label: "Pause Voyage",
      detail: "Use the existing canonical pause command if the Crew needs a safe hold while evidence recovers.",
      commandId: "PAUSE_VOYAGE",
    });
  if (input.lifecycle === "PAUSED")
    steps.push({
      id: "RESUME",
      label: "Resume Voyage",
      detail: "Resume only after the current authoritative state and Crew readiness have been reviewed.",
      commandId: "RESUME_VOYAGE",
    });
  if (degraded.some((item) => item.category === "CONNECTION"))
    steps.push({
      id: "REPLAY_PRESENTATION",
      label: "Replay current presentation",
      detail: "Replay the existing current presentation without changing canonical progression.",
      commandId: "REPLAY_PRESENTATION",
    });
  if (input.hasPriorPassage && degraded.length)
    steps.push({
      id: "RESTORE_PRIOR_PASSAGE",
      label: "Restore prior Passage",
      detail: "Use the existing compensating recovery command only after reviewing its Captain confirmation.",
      commandId: "RESTORE_PRIOR_PASSAGE",
    });
  if (critical || input.presentationProvider === "UNAVAILABLE")
    steps.push({
      id: "ESCALATE",
      label: "Escalate safely",
      detail:
        "No unsupported repair is available. Preserve the authoritative evidence and use the owning provider or support path.",
      commandId: null,
    });

  return {
    preflight: { state: preflightState, checks },
    recovery: {
      state:
        critical || input.presentationProvider === "UNAVAILABLE"
          ? "ESCALATE"
          : degraded.length
            ? "ACTIONABLE"
            : "HEALTHY",
      diagnosis: critical
        ? "A critical authoritative condition blocks unsupported repair."
        : degraded.length
          ? `${degraded[0]!.title} requires a governed recovery decision.`
          : "No current connection or system condition requires recovery.",
      evidence: { sourceRevision: input.currentSequence, observedAt: input.observedAt.toISOString() },
      steps,
    },
  };
}

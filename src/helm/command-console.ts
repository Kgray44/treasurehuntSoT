import type { PublishedTaleSnapshot } from "@/chronicle/types";

export const captainConsoleCommandIds = [
  "APPROVE_VERIFICATION",
  "REJECT_VERIFICATION",
  "OVERRIDE_VERIFICATION",
  "RELEASE_NEXT_HINT",
  "PAUSE_VOYAGE",
  "RESUME_VOYAGE",
  "REPLAY_PRESENTATION",
  "RESTORE_PRIOR_PASSAGE",
  "MOVE_TO_PASSAGE",
] as const;

export type CaptainConsoleCommandId = (typeof captainConsoleCommandIds)[number];
export type CaptainConsoleRisk = "LOW" | "MEDIUM" | "HIGH";
export type CaptainSessionActionName =
  | "approve"
  | "reject"
  | "override"
  | "pause"
  | "resume"
  | "presentation"
  | "releaseHint"
  | "rollback"
  | "jump";

export type CaptainProgressMapNode = Readonly<{
  id: string;
  chapterId: string;
  chapterTitle: string;
  title: string;
  blockType: string;
  state: "COMPLETED" | "CURRENT" | "UPCOMING" | "OPTIONAL" | "BLOCKED";
  outgoingCount: number;
}>;

export type CaptainConsoleCommandOption = Readonly<{
  id: CaptainConsoleCommandId;
  action: CaptainSessionActionName;
  label: string;
  description: string;
  risk: CaptainConsoleRisk;
  reversible: boolean;
  playersSeeResult: boolean;
  consequence: string;
  warning: string | null;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  target: "NONE" | "PASSAGE";
}>;

type ProgressEvent = Readonly<{ blockId: string | null; eventType: string; sequence: number }>;

const terminalLifecycles = new Set(["COMPLETED", "ABANDONED", "CANCELLED"]);

function isHintList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

export function buildCaptainProgressMap(input: {
  snapshot: PublishedTaleSnapshot;
  currentBlockId: string | null;
  lifecycle: string;
  events: readonly ProgressEvent[];
}): CaptainProgressMapNode[] {
  const completed = new Set(
    input.events
      .filter((event) => event.eventType === "blockCompleted" && event.blockId)
      .map((event) => event.blockId!),
  );
  const optionalBlockIds = new Set(
    input.snapshot.chapters
      .flatMap((chapter) => chapter.blocks)
      .flatMap((block) => block.connections)
      .filter((connection) => /optional|side.?quest/i.test(connection.connectionType))
      .map((connection) => connection.targetBlockId),
  );
  const blocked = input.lifecycle === "PAUSED";
  return input.snapshot.chapters.flatMap((chapter) =>
    chapter.blocks.map((block) => {
      const optional = optionalBlockIds.has(block.id);
      const state = completed.has(block.id)
        ? "COMPLETED"
        : block.id === input.currentBlockId
          ? "CURRENT"
          : blocked
            ? "BLOCKED"
            : optional
              ? "OPTIONAL"
              : "UPCOMING";
      return {
        id: block.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        title: block.title,
        blockType: block.blockType,
        state,
        outgoingCount: block.connections.length,
      };
    }),
  );
}

export function deriveCaptainConsoleCommands(input: {
  lifecycle: string;
  captainAuthorityState: string;
  currentBlockId: string | null;
  pendingVerification: { providerType: string } | null;
  hintCount: number;
  releasedHintCount: number;
  priorPassageId: string | null;
}): CaptainConsoleCommandOption[] {
  if (terminalLifecycles.has(input.lifecycle) || input.captainAuthorityState !== "ASSIGNED") return [];
  const commands: CaptainConsoleCommandOption[] = [];
  const active = input.lifecycle === "ACTIVE";
  const paused = input.lifecycle === "PAUSED";

  if (input.pendingVerification) {
    commands.push(
      {
        id: "APPROVE_VERIFICATION",
        action: "approve",
        label: "Approve verification",
        description: `Accept the current ${input.pendingVerification.providerType} result and let canonical progression continue.`,
        risk: "HIGH",
        reversible: false,
        playersSeeResult: true,
        consequence: "The pending verification is resolved and the current Passage may advance.",
        warning: "This changes shared Voyage progress.",
        requiresConfirmation: true,
        requiresReason: false,
        target: "NONE",
      },
      {
        id: "REJECT_VERIFICATION",
        action: "reject",
        label: "Request another attempt",
        description: "Keep the Voyage at the current Passage and record that another verification attempt is needed.",
        risk: "MEDIUM",
        reversible: true,
        playersSeeResult: true,
        consequence: "The current verification is rejected without advancing the Voyage.",
        warning: null,
        requiresConfirmation: true,
        requiresReason: true,
        target: "NONE",
      },
      {
        id: "OVERRIDE_VERIFICATION",
        action: "override",
        label: "Approve with Captain override",
        description:
          "Use the existing governed Captain override when the normal verification path cannot resolve the current request.",
        risk: "HIGH",
        reversible: false,
        playersSeeResult: true,
        consequence:
          "The verification is accepted through the canonical Captain override path and the decision is audited.",
        warning: "Use only when the normal evidence path cannot resolve the request.",
        requiresConfirmation: true,
        requiresReason: true,
        target: "NONE",
      },
    );
  }

  if (active && input.hintCount > input.releasedHintCount) {
    const remaining = input.hintCount - input.releasedHintCount;
    commands.push({
      id: "RELEASE_NEXT_HINT",
      action: "releaseHint",
      label: "Release next hint",
      description: `Release the next of ${remaining} currently available Captain hint${remaining === 1 ? "" : "s"}.`,
      risk: "MEDIUM",
      reversible: false,
      playersSeeResult: true,
      consequence: "Players receive the next published hint for their current Passage.",
      warning: "Released hints remain part of the Voyage record.",
      requiresConfirmation: true,
      requiresReason: false,
      target: "NONE",
    });
  }

  if (active) {
    commands.push(
      {
        id: "PAUSE_VOYAGE",
        action: "pause",
        label: "Pause Voyage",
        description: "Pause the live Voyage through the existing lifecycle command.",
        risk: "HIGH",
        reversible: true,
        playersSeeResult: true,
        consequence: "The Voyage pauses until a Captain resumes it.",
        warning: "Players immediately see that live progression is paused.",
        requiresConfirmation: true,
        requiresReason: false,
        target: "NONE",
      },
      {
        id: "REPLAY_PRESENTATION",
        action: "presentation",
        label: "Replay current presentation",
        description: "Ask the canonical runtime to replay the current presentation without changing progression.",
        risk: "LOW",
        reversible: true,
        playersSeeResult: true,
        consequence: "The current presentation is replayed; Voyage progression does not change.",
        warning: null,
        requiresConfirmation: false,
        requiresReason: false,
        target: "NONE",
      },
      {
        id: "MOVE_TO_PASSAGE",
        action: "jump",
        label: "Move Crew to Passage",
        description: "Use the existing Captain passage move for an explicitly chosen published Passage.",
        risk: "HIGH",
        reversible: false,
        playersSeeResult: true,
        consequence:
          "Pending verification is cleared and the Crew moves to the chosen Passage through canonical progression.",
        warning: "This bypasses normal progression between Passages and is recorded in the operational history.",
        requiresConfirmation: true,
        requiresReason: true,
        target: "PASSAGE",
      },
    );
    if (input.priorPassageId) {
      commands.push({
        id: "RESTORE_PRIOR_PASSAGE",
        action: "rollback",
        label: "Restore prior Passage",
        description: "Use the existing compensating Captain recovery command to return to the prior entered Passage.",
        risk: "HIGH",
        reversible: true,
        playersSeeResult: true,
        consequence: "Pending verification is cleared and the Crew returns to the prior Passage.",
        warning: "This changes shared Voyage progress and is recorded in the operational history.",
        requiresConfirmation: true,
        requiresReason: true,
        target: "NONE",
      });
    }
  }

  if (paused) {
    commands.push({
      id: "RESUME_VOYAGE",
      action: "resume",
      label: "Resume Voyage",
      description: "Resume the live Voyage through the existing lifecycle command.",
      risk: "HIGH",
      reversible: true,
      playersSeeResult: true,
      consequence: "The Voyage resumes at its current Passage.",
      warning: "Players immediately see that live progression has resumed.",
      requiresConfirmation: true,
      requiresReason: false,
      target: "NONE",
    });
  }
  return commands;
}

export function countCurrentHints(snapshot: PublishedTaleSnapshot, currentBlockId: string | null) {
  const block = currentBlockId
    ? (snapshot.chapters.flatMap((chapter) => chapter.blocks).find((candidate) => candidate.id === currentBlockId) ??
      null)
    : null;
  return block && isHintList(block.configuration.hints) ? block.configuration.hints.length : 0;
}

export function findCaptainConsoleCommand(
  commands: readonly CaptainConsoleCommandOption[],
  commandId: string,
): CaptainConsoleCommandOption | null {
  return commands.find((command) => command.id === commandId) ?? null;
}

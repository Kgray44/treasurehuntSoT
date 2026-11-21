"use client";
import {
  isAdvancedAssistantOperation,
  advancedOperationTitle,
  advancedOperationDescription,
} from "@/parallax/assistant-advanced-operations";
import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { AnimatePresence, motion } from "motion/react";
import { resolvePlatformMotionToken, platformMotionEasing } from "@/animation/platform/motion-tokens";
import { evaluateSpatialScene } from "@/parallax/behavior";
import type { RendererReceipt } from "./spatial-workstation";
import type { SpatialDraft } from "@/parallax/authoring";
import { spatialId } from "@/parallax/contracts";
import {
  assistantProposalSchema,
  materializeAssistantProposal,
  type AssistantProposal,
  type AssistantOperation,
} from "@/parallax/spatial-assistant";
import type { AssistantRequest } from "@/parallax/spatial-assistant-service";
import type { EditingGroupMember } from "@/parallax/editing-group-contracts";
import type { creatorAIUsage } from "@/parallax/ai-ledger";
import styles from "./SpatialAssistant.module.css";

type Usage = Awaited<ReturnType<typeof creatorAIUsage>>;
export type SpatialAssistantReply = {
  status: string;
  proposal?: AssistantProposal;
  usage?: Usage;
  code?: string;
  message?: string;
};
export type SpatialAssistantBase = { draft: SpatialDraft; revision: number; editorGeneration: number };
export type SpatialAssistantSavedDraft = { status: "SAVED"; draft: SpatialDraft; revision: number };
export type SpatialAssistantPort = {
  reportOutcome?: (requestId: string, decision: "PREVIEWED" | "REJECTED") => Promise<unknown>;
  prepareBase: () => Promise<SpatialAssistantBase>;
  request: (input: AssistantRequest, signal: AbortSignal) => Promise<SpatialAssistantReply>;
  apply: (
    proposal: AssistantProposal,
    selectedOperationIds: readonly string[],
    idempotencyKey: string,
  ) => Promise<SpatialAssistantSavedDraft>;
};
export type SpatialAssistantProps = {
  headerProps?: HTMLAttributes<HTMLElement> & { "data-floating-gesture"?: string };
  windowControls?: ReactNode;
  taskResetVersion?: number;
  draft: SpatialDraft;
  revision: number;
  editorGeneration: number;
  selectedEntityId: string | null;
  selectedGroupId?: string | null;
  selectedMembers?: readonly EditingGroupMember[];
  environmentEditing?: boolean;
  accountId: string;
  usage: Usage;
  port: SpatialAssistantPort;
  onPreview: (next: SpatialDraft | null, affectedEntityIds: readonly string[]) => void;
  onSelect: (entityId: string) => void;
  onUndo: () => void | Promise<void>;
  onRedo: () => void | Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  onClose?: () => void;
  onCanvasView?: () => void;
  renderedSceneVersion?: string;
  renderedEntities?: Record<string, RendererReceipt["status"]>;
};
type Stage =
  | "IDLE"
  | "PREPARING"
  | "INTERPRETING"
  | "RECEIVING"
  | "VALIDATING"
  | "PREVIEW"
  | "CLARIFICATION"
  | "UNSUPPORTED"
  | "APPLYING"
  | "ACCEPTED"
  | "CANCELLED"
  | "FAILED"
  | "UNAVAILABLE";
const stageText: Record<Stage, string> = {
  IDLE: "Ready when you are",
  PREPARING: "Saving and preparing scene context…",
  INTERPRETING: "Interpreting your idea…",
  RECEIVING: "Response received",
  VALIDATING: "Checking the proposed changes…",
  PREVIEW: "Proposal ready for your review",
  CLARIFICATION: "A little clarification will help",
  UNSUPPORTED: "A supported alternative is needed",
  APPLYING: "Applying and saving reviewed changes…",
  ACCEPTED: "Your changes are saved",
  CANCELLED: "Request cancelled",
  FAILED: "The request could not finish",
  UNAVAILABLE: "Assistance is unavailable",
};
const suggestions = [
  {
    title: "Place an object",
    detail: "Give a clue its place in the scene",
    prompt: "Place a readable old pirate note on a desk near the entrance.",
    icon: "object",
  },
  {
    title: "Add an interaction",
    detail: "Reveal something on inspect",
    prompt: "When the Player inspects the selected object, highlight it after one second.",
    icon: "spark",
  },
  {
    title: "Improve my scene",
    detail: "Refine scale and arrangement",
    prompt: "Make the selected map smaller and move it a little to the left. Preserve its clue text.",
    icon: "scene",
  },
  {
    title: "Check accessibility",
    detail: "Keep the experience camera-free",
    prompt:
      "Review this scene for someone using a keyboard or seated without a camera. Suggest a readable Guided fallback.",
    icon: "access",
  },
];
function SuggestionIcon({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="36"
      height="36"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      {kind === "object" ? (
        <>
          <path d="m7 13 13-7 13 7-13 8Z" />
          <path d="M7 13v15l13 7 13-7V13M20 21v14" />
        </>
      ) : kind === "spark" ? (
        <>
          <path d="m20 5 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" />
          <path d="m30 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
        </>
      ) : kind === "scene" ? (
        <>
          <path d="M7 29h26M11 25V10h18v15M15 15h10M15 20h7" />
          <circle cx="29" cy="27" r="4" />
        </>
      ) : (
        <>
          <circle cx="20" cy="8" r="3" />
          <path d="M8 17h24M20 13v11m0-4-9 13m9-13 9 13" />
        </>
      )}
    </svg>
  );
}
function operationTitle(operation: AssistantOperation) {
  if (isAdvancedAssistantOperation(operation)) return advancedOperationTitle(operation);
  return {
    CREATE: "New spatial object",
    CONTENT: "Object details",
    PLACEMENT: "Placement",
    ROOM_PLACEMENT: "Room feature placement",
    SEMANTIC_PLACEMENT: "Adaptive placement",
    TRANSFORM: "Position & scale",
    RELATIVE_TRANSFORM: "Move & resize",
    VISIBILITY: "Visibility",
    BEHAVIOR: "Interaction & timing",
    FALLBACK: "Guided accessibility",
    GROUP_CREATE: "New group",
    GROUP_MEMBERS: "Group members",
    GROUP_RENAME: "Group name",
    GROUP_UNGROUP: "Ungroup items",
    GROUP_TRANSFORM: "Move, rotate & scale group",
  }[operation.type];
}
function operationDescription(operation: AssistantOperation, draft: SpatialDraft) {
  if (isAdvancedAssistantOperation(operation)) return advancedOperationDescription(operation, draft);
  const name =
    "entityId" in operation
      ? (draft.content.entities.find((entity) => entity.id === operation.entityId)?.name ??
        (operation.type === "CREATE" ? operation.name : "Proposed object"))
      : "Guided experience";
  switch (operation.type) {
    case "RELATIVE_TRANSFORM":
      return `${name} · move by ${operation.translation.x}, ${operation.translation.y}, ${operation.translation.z} m · size ×${operation.scaleFactor}`;
    case "GROUP_CREATE":
      return `${operation.name} · ${operation.members.length} items`;
    case "GROUP_MEMBERS":
      return `${draft.content.studio?.editingGroups?.find((group) => group.id === operation.groupId)?.name ?? "Group"} · ${operation.members.length} members`;
    case "GROUP_RENAME":
      return `Rename group to ${operation.name}`;
    case "GROUP_UNGROUP":
      return "Remove grouping; keep its items and their current poses";
    case "GROUP_TRANSFORM": {
      const changes = [];
      if (Object.values(operation.translation).some((value) => value !== 0))
        changes.push(
          `move by X ${operation.translation.x} m, Y ${operation.translation.y} m, Z ${operation.translation.z} m (world axes)`,
        );
      if (operation.yawDegrees !== 0) changes.push(`rotate ${operation.yawDegrees}°`);
      if (operation.scale !== 1) changes.push(`scale ×${operation.scale}`);
      return `${draft.content.studio?.editingGroups?.find((group) => group.id === operation.groupId)?.name ?? "Group"} · ${changes.join(", ") || "keep the current pose"}`;
    }
    case "CREATE":
      return `${operation.name} · ${operation.placement === "DESK" ? "on a horizontal surface" : operation.placement === "WALL" ? "on a wall" : operation.placement === "ENTRANCE" ? "near the entrance" : "in the local scene"}`;
    case "PLACEMENT":
      return `${name} · ${operation.placement.toLowerCase()}`;
    case "ROOM_PLACEMENT": {
      const room = draft.content.studio?.environment;
      const target =
        room?.features.find((f) => f.id === operation.targetFeatureId)?.name ?? operation.classification.toLowerCase();
      const near = room?.features.find((f) => f.id === operation.nearFeatureId)?.name;
      return `${name} · on ${target}${near ? ` near ${near}` : ""} · editable room geometry`;
    }
    case "SEMANTIC_PLACEMENT":
      return `${name} · ${operation.relativePlacement.toLowerCase()} on ${operation.surface.toLowerCase().replaceAll("_", " ")}${operation.context ? ` near ${operation.context.toLowerCase()}` : ""} · adaptive recipe, calibration review required`;
    case "TRANSFORM":
      return `${name} · position and size adjustment`;
    case "CONTENT":
      return `${name} · ${[operation.name && "name", operation.content && "clue text", operation.alternativeText && "accessible description", operation.widthMeters && "size", operation.interactions && "interactions"].filter(Boolean).join(", ")}`;
    case "VISIBILITY":
      return `${name} · ${operation.visible ? "visible" : "hidden with a reviewed reveal"}`;
    case "BEHAVIOR":
      return `${operation.trigger.toLowerCase().replaceAll("_", " ")} → ${operation.action.toLowerCase()}${operation.delayMs ? ` after ${operation.delayMs / 1000}s` : ""}`;
    case "FALLBACK":
      return "Readable meaning without a camera or precision movement";
  }
}
export function SpatialAssistant(props: SpatialAssistantProps) {
  return <SpatialAssistantSession key={`${props.accountId}:${props.draft.content.definitionId}`} {...props} />;
}
function SpatialAssistantSession(props: SpatialAssistantProps) {
  const { mode: motionMode } = useMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", motionMode);
  const transition = { duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") };
  const [sentRequest, setSentRequest] = useState("");
  const [currentResponse, setCurrentResponse] = useState<AssistantProposal | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState("");
  const [conversation, setConversation] = useState<
    { id: string; request: string; response: AssistantProposal | null }[]
  >([]);
  const [savedRenderReview, setSavedRenderReview] = useState<{
    sceneVersion: string;
    entities: { id: string; name: string; visible: boolean }[];
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false),
    [composer, setComposer] = useState(""),
    [stage, setStage] = useState<Stage>("IDLE"),
    [notice, setNotice] = useState(""),
    [usageReply, setUsageReply] = useState<{ base: Usage; value: Usage } | null>(null);
  const [proposal, setProposal] = useState<AssistantProposal | null>(null),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [advanced, setAdvanced] = useState(false),
    [restored, setRestored] = useState(false),
    [previousRequestId, setPreviousRequestId] = useState<string | null>(null),
    [previewing, setPreviewing] = useState(false);
  const [baseState, setBaseState] = useState("");
  const controller = useRef<AbortController | null>(null),
    input = useRef<HTMLTextAreaElement>(null),
    body = useRef<HTMLDivElement>(null),
    review = useRef<HTMLElement>(null),
    requestGeneration = useRef(0),
    mounted = useRef(true),
    latest = useRef(props),
    applyKeys = useRef(new Map<string, string>());
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    if (proposal) review.current?.focus();
  }, [proposal]);
  const usage = usageReply?.base === props.usage ? usageReply.value : props.usage;
  const working = ["PREPARING", "INTERPRETING", "RECEIVING", "VALIDATING", "APPLYING"].includes(stage);
  const selected = props.draft.content.entities.find((entity) => entity.id === props.selectedEntityId);
  const sessionKey = `parallax.assistant.v1:${props.accountId}:${props.draft.content.definitionId}`;
  const taskResetVersion = useRef(props.taskResetVersion);
  useEffect(() => {
    if (taskResetVersion.current === props.taskResetVersion) return;
    taskResetVersion.current = props.taskResetVersion;
    requestGeneration.current++;
    controller.current?.abort();
    queueMicrotask(() => {
      setSentRequest("");
      setCurrentResponse(null);
      setConversation([]);
      setProposal(null);
      setSelectedIds([]);
      setPreviousRequestId(null);
      setComposer("");
      setPreviewing(false);
      setRestored(false);
      setStage("IDLE");
      setNotice("");
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {}
    });
  }, [props.taskResetVersion, sessionKey]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = sessionStorage.getItem(sessionKey);
        const state = saved ? JSON.parse(saved) : null;
        const recent =
          Number.isFinite(state?.lastRequestAt) &&
          Date.now() >= state.lastRequestAt &&
          Date.now() - state.lastRequestAt < 86400000;
        setRestored(Boolean(recent));
        if (recent && spatialId.safeParse(state?.previousRequestId).success)
          setPreviousRequestId(state.previousRequestId);
      } catch {
        setRestored(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);
  const stale = Boolean(
    proposal &&
      (baseState !== JSON.stringify(props.draft) ||
        props.revision !== proposal.sceneRevision ||
        props.editorGeneration !== proposal.editorGeneration),
  );
  const previewPort = props.onPreview;
  useEffect(() => {
    if (!stale) return;
    previewPort(null, []);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setProposal(null);
        setSelectedIds([]);
        setPreviewing(false);
        setStage("IDLE");
        setNotice("Your scene has changed. Regenerate this proposal to preserve your newer work.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stale, previewPort]);
  const shownNotice = stale ? "Your scene has changed. Regenerate this proposal to preserve your newer work." : notice;
  useLayoutEffect(() => {
    if (shownNotice && (stage === "FAILED" || stage === "UNAVAILABLE" || stage === "CANCELLED") && body.current)
      body.current.scrollTop = 0;
  }, [shownNotice, stage]);
  function affected(ids: readonly string[]) {
    return [
      ...new Set(
        (proposal?.operations ?? [])
          .filter((operation) => ids.includes(operation.id))
          .flatMap((operation) =>
            operation.type === "DUPLICATE"
              ? [operation.newEntityId]
              : operation.type === "ANIMATION"
                ? [operation.track.entityId]
                : "entityId" in operation
                  ? [operation.entityId]
                  : operation.type === "BEHAVIOR"
                    ? [operation.targetEntityId]
                    : "groupId" in operation
                      ? ("members" in operation
                          ? operation.members
                          : (latest.current.draft.content.studio?.editingGroups?.find(
                              (group) => group.id === operation.groupId,
                            )?.members ?? [])
                        )
                          .filter((member) => member.kind === "ASSET")
                          .map((member) => member.id)
                      : [],
          ),
      ),
    ];
  }
  async function showPreview(ids: readonly string[], enabled = true) {
    if (!proposal) return false;
    try {
      if (enabled) {
        const base = latest.current;
        const next = await materializeAssistantProposal(
          base.draft,
          base.revision,
          proposal,
          ids,
          base.editorGeneration,
        );
        if (
          latest.current.editorGeneration !== base.editorGeneration ||
          latest.current.revision !== base.revision ||
          JSON.stringify(latest.current.draft) !== JSON.stringify(base.draft)
        )
          throw new Error("Your scene has changed. Regenerate this proposal to preserve your newer work.");
        latest.current.onPreview(next, affected(ids));
        void latest.current.port
          .reportOutcome?.(proposal.requestId, "PREVIEWED")
          .catch(() => setNotice("Preview is available; its usage feedback could not be recorded."));
      } else latest.current.onPreview(null, []);
      setPreviewing(enabled);
      setNotice("");
      return true;
    } catch (cause) {
      latest.current.onPreview(null, []);
      setPreviewing(false);
      setNotice(cause instanceof Error ? cause.message : "Choose a complete set of related changes.");
      return false;
    }
  }
  async function submit() {
    if (working || !composer.trim() || !usage.enabled) return;
    const message = composer.trim();
    const generation = ++requestGeneration.current,
      abort = new AbortController();
    controller.current = abort;
    if (sentRequest && currentResponse)
      setConversation((turns) => [...turns, { id: currentMessageId, request: sentRequest, response: currentResponse }]);
    setCurrentResponse(null);
    setCurrentMessageId(crypto.randomUUID());
    setNotice("");
    setSentRequest(message);
    setComposer("");
    setStage("PREPARING");
    setProposal(null);
    latest.current.onPreview(null, []);
    setPreviewing(false);
    try {
      const snapshot = await latest.current.port.prepareBase();
      if (abort.signal.aborted || generation !== requestGeneration.current) return;
      setBaseState(JSON.stringify(snapshot.draft));
      setStage("INTERPRETING");
      const reply = await latest.current.port.request(
        {
          draft: snapshot.draft,
          revision: snapshot.revision,
          editorGeneration: snapshot.editorGeneration,
          requestId: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
          request: message,
          selectedEntityId: latest.current.selectedEntityId,
          selectedGroupId: latest.current.selectedGroupId ?? null,
          selectedMembers: latest.current.selectedMembers ? [...latest.current.selectedMembers] : [],
          environmentEditing: latest.current.environmentEditing ?? false,
          previousRequestId,
          mode: advanced ? "ADVANCED" : "STANDARD",
        },
        abort.signal,
      );
      if (!mounted.current || abort.signal.aborted || generation !== requestGeneration.current) return;
      if (
        latest.current.editorGeneration !== snapshot.editorGeneration ||
        latest.current.revision !== snapshot.revision ||
        JSON.stringify(latest.current.draft) !== JSON.stringify(snapshot.draft)
      )
        throw new Error("Your scene has changed. Regenerate this proposal to preserve your newer work.");
      setStage("RECEIVING");
      if (reply.usage) setUsageReply({ base: latest.current.usage, value: reply.usage });
      if (reply.status !== "PROPOSED" || !reply.proposal) {
        setStage(reply.status === "UNAVAILABLE" ? "UNAVAILABLE" : "FAILED");
        setNotice(reply.message ?? "No changes were prepared. Your scene is unchanged.");
        return;
      }
      setStage("VALIDATING");
      const checked = assistantProposalSchema.parse(reply.proposal);
      await materializeAssistantProposal(
        snapshot.draft,
        snapshot.revision,
        checked,
        undefined,
        snapshot.editorGeneration,
      );
      if (abort.signal.aborted || generation !== requestGeneration.current) return;
      if (
        latest.current.editorGeneration !== snapshot.editorGeneration ||
        latest.current.revision !== snapshot.revision ||
        JSON.stringify(latest.current.draft) !== JSON.stringify(snapshot.draft)
      )
        throw new Error("Your scene has changed. Regenerate this proposal to preserve your newer work.");
      setProposal(checked);
      setPreviousRequestId(checked.requestId);
      setCurrentResponse(checked);
      setSelectedIds(checked.operations.map((operation) => operation.id));
      setStage(
        checked.clarification ? "CLARIFICATION" : checked.intentType === "UNSUPPORTED" ? "UNSUPPORTED" : "PREVIEW",
      );
      // Persist only timing/count and an owner/draft-scoped context identity, never text or scenes.
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            lastRequestAt: Date.now(),
            operationCount: checked.operations.length,
            previousRequestId: checked.requestId,
          }),
        );
      } catch {}
      setRestored(false);
    } catch (cause) {
      if (!mounted.current || generation !== requestGeneration.current) return;
      setStage(abort.signal.aborted ? "IDLE" : "FAILED");
      setNotice(
        abort.signal.aborted
          ? "Assistance cancelled. Your scene is unchanged."
          : cause instanceof Error
            ? cause.message
            : "Assistance could not finish. Your scene is unchanged.",
      );
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }
  async function apply() {
    if (!proposal || stale || !selectedIds.length || working) return;
    setStage("APPLYING");
    setNotice("");
    try {
      const next = await materializeAssistantProposal(
        latest.current.draft,
        latest.current.revision,
        proposal,
        selectedIds,
        latest.current.editorGeneration,
      );
      const identity = `${proposal.requestId}:${[...selectedIds].sort().join(",")}`;
      if (!applyKeys.current.has(identity)) applyKeys.current.set(identity, crypto.randomUUID());
      const saved = await latest.current.port.apply(proposal, selectedIds, applyKeys.current.get(identity)!);
      if (
        saved.status !== "SAVED" ||
        saved.revision !== proposal.sceneRevision + 1 ||
        JSON.stringify(saved.draft) !== JSON.stringify(next)
      )
        throw new Error(
          "The canonical save acknowledgement could not be verified. Retry this reviewed change before installing it.",
        );
      const ids = affected(selectedIds);
      const states = evaluateSpatialScene(saved.draft.content, [], 0, true).states;
      setSavedRenderReview({
        sceneVersion: JSON.stringify(saved.draft),
        entities: saved.draft.content.entities
          .filter((entity) => ids.includes(entity.id))
          .map((entity) => ({
            id: entity.id,
            name: entity.name,
            visible: states[entity.id].visible,
          })),
      });
      latest.current.onPreview(null, []);
      setPreviewing(false);
      setProposal(null);
      setStage("ACCEPTED");
      setNotice("Reviewed changes are saved. You can undo them using ordinary editor history.");
    } catch (cause) {
      setStage("PREVIEW");
      setNotice(cause instanceof Error ? cause.message : "The changes could not be saved. Your scene is unchanged.");
    }
  }
  if (collapsed)
    return (
      <button className={styles.launcher} aria-expanded="false" onClick={() => setCollapsed(false)}>
        <SuggestionIcon kind="spark" />
        Spatial Assistant<span>Describe your next idea</span>
      </button>
    );
  return (
    <aside role="region" className={styles.assistant} data-motion={motionMode} aria-label="Spatial Assistant">
      <header className={styles.header} {...props.headerProps}>
        <div className={styles.emblem}>
          <SuggestionIcon kind="spark" />
        </div>
        <div>
          <p>PARALLAX</p>
          <h2>
            {props.headerProps ? (
              <button
                type="button"
                className={styles.headerDragTitle}
                {...props.headerProps}
                aria-label="Move floating Spatial Assistant"
              >
                Spatial Assistant
              </button>
            ) : (
              "Spatial Assistant"
            )}
          </h2>
        </div>
        {props.windowControls ?? (
          <button
            aria-label="Collapse Spatial Assistant"
            aria-expanded="true"
            onClick={() => {
              setSentRequest("");
              setCurrentResponse(null);
              setConversation([]);
              props.onPreview(null, []);
              setPreviewing(false);
              setCollapsed(true);
              props.onClose?.();
            }}
          >
            −
          </button>
        )}
      </header>
      <div className={styles.context}>
        <span className={styles.contextDot} aria-hidden="true" />
        <span>
          {props.draft.content.studio?.editingGroups?.find((group) => group.id === props.selectedGroupId)?.name ??
            (props.selectedMembers && props.selectedMembers.length > 1
              ? `${props.selectedMembers.length} selected items`
              : selected
                ? selected.name
                : "Whole scene")}
        </span>
        <small>{props.draft.content.entities.length} objects</small>
        {props.onCanvasView && <button onClick={props.onCanvasView}>View canvas</button>}
      </div>
      <div className={styles.body} ref={body} role="region" aria-label="Assistance response" tabIndex={0}>
        <AnimatePresence initial={false}>
          {[
            ...conversation,
            ...(sentRequest
              ? [
                  {
                    id: currentMessageId,
                    request: sentRequest,
                    response: !proposal && !working ? currentResponse : null,
                  },
                ]
              : []),
          ].map((turn) => (
            <motion.div
              key={turn.id}
              className={styles.chatTurn}
              initial={{ opacity: 0, y: stateMotion.distancePx }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -stateMotion.distancePx }}
              transition={transition}
            >
              <div className={styles.sentRequest}>
                <span className={styles.kicker}>YOUR IDEA</span>
                <p>{turn.request}</p>
              </div>
              {turn.response && (
                <div className={styles.previousReply}>
                  <p>{turn.response.summary}</p>
                  {turn.response.clarification && (
                    <p className={styles.previousQuestion}>{turn.response.clarification}</p>
                  )}
                  <details>
                    <summary>Earlier response</summary>
                    <p>{turn.response.creatorExplanation}</p>
                    {turn.response.operations.map((operation) => (
                      <p key={operation.id}>
                        {operationDescription(operation, props.draft)} · {operation.explanation}
                      </p>
                    ))}
                    {[
                      ...turn.response.warnings,
                      ...turn.response.assumptions,
                      ...turn.response.accessibilityNotes,
                      ...turn.response.unsupportedCapabilities,
                    ].map((note, index) => (
                      <p key={index}>{note}</p>
                    ))}
                  </details>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {restored && (
          <p className={styles.notice} role="status">
            Your task session is restored. I’ll use the current saved scene for your next request.
          </p>
        )}
        {!proposal && !working && stage === "IDLE" && (
          <section className={styles.welcome}>
            <span className={styles.kicker}>FROM IDEA TO EXPERIENCE</span>
            <h3>
              What would you like
              <br />
              to create?
            </h3>
            <p>Describe your idea. I’ll help turn it into a spatial experience.</p>
            <div className={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  onClick={() => {
                    setComposer(suggestion.prompt);
                    input.current?.focus();
                  }}
                >
                  <SuggestionIcon kind={suggestion.icon} />
                  <span>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.detail}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className={styles.reassurance}>You review every change. Your scene stays yours.</p>
          </section>
        )}
        <AnimatePresence initial={false} mode="wait">
          {working && (
            <motion.div
              key="thinking"
              className={styles.thinking}
              aria-label="Assistant thinking"
              initial={{ opacity: 0, y: stateMotion.distancePx, scale: 1 - stateMotion.scaleDelta }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -stateMotion.distancePx, scale: 1 - stateMotion.scaleDelta }}
              transition={transition}
            >
              <div className={styles.thinkingOrb} aria-hidden="true">
                <span className={styles.thinkingRing} />
                <span className={styles.thinkingRing} />
                <span className={styles.thinkingSpark}>✦</span>
              </div>
              <strong>{stage === "APPLYING" ? "Bringing your scene together" : "Shaping your idea"}</strong>
              <span className={styles.thinkingDots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.p
          transition={transition}
          className={working || (proposal && stage !== "ACCEPTED") ? styles.screenReaderStatus : styles.activity}
          role="status"
          aria-live="polite"
          data-working={working}
        >
          <motion.span
            key={stage}
            aria-hidden="true"
            initial={
              motionMode === "reduced"
                ? false
                : { opacity: 0.35, scale: 1 - stateMotion.scaleDelta * 4, rotate: working ? -30 : 0 }
            }
            animate={{ opacity: 1, scale: 1, rotate: working && motionMode !== "reduced" ? 30 : 0 }}
            transition={{ duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") }}
          >
            {working ? "◌" : stage === "ACCEPTED" ? "✓" : "✦"}
          </motion.span>
          {stageText[stage]}
        </motion.p>
        {stage === "ACCEPTED" && savedRenderReview && (
          <section aria-label="Saved scene canvas check" className={styles.notice}>
            {props.renderedSceneVersion !== savedRenderReview.sceneVersion ? (
              <p>The changes are saved. Canvas confirmation is pending; open the canvas to inspect this scene.</p>
            ) : savedRenderReview.entities.length === 0 ? (
              <p>The saved scene has rendered. These changes do not add or move a visible object.</p>
            ) : (
              savedRenderReview.entities.map((entity) => {
                const status = props.renderedEntities?.[entity.id];
                const visible = status === "IN_VIEW";
                const authoredHidden = status === "HIDDEN" && !entity.visible;
                return (
                  <p key={entity.id}>
                    <strong>{entity.name}</strong>:{" "}
                    {visible
                      ? "rendered in the current view."
                      : authoredHidden
                        ? "saved hidden as authored. Preview its reveal in the timeline."
                        : `saved, but ${status === "OUTSIDE_VIEW" ? "outside the current view" : status === "OCCLUDED" ? "occluded in this view" : status === "TOO_SMALL" ? "too small to read in this view" : status === "HIDDEN" ? "hidden in the current preview" : status === "TRANSPARENT" ? "transparent at the current animation time" : "its geometry is not confirmed"}.`}
                    {!visible && !authoredHidden && (
                      <button
                        type="button"
                        onClick={() => {
                          props.onSelect(entity.id);
                          props.onCanvasView?.();
                        }}
                      >
                        Locate {entity.name} in canvas
                      </button>
                    )}
                  </p>
                );
              })
            )}
          </section>
        )}
        {shownNotice && (
          <p className={styles.notice} role="status">
            {shownNotice}
          </p>
        )}
        {proposal && (
          <motion.section
            key={proposal.requestId}
            initial={{ opacity: 0, y: stateMotion.distancePx }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -stateMotion.distancePx }}
            transition={transition}
            className={styles.proposal}
            ref={review}
            tabIndex={-1}
            aria-label="Review spatial proposal"
          >
            <h3>{proposal.summary}</h3>
            {proposal.clarification && (
              <div className={styles.clarification}>
                <h4>One quick clarification</h4>
                <p>{proposal.clarification}</p>
                <button onClick={() => input.current?.focus()}>Answer below</button>
              </div>
            )}
            {proposal.unsupportedCapabilities.length > 0 && (
              <div className={styles.notice}>
                <h4>Capability limits</h4>
                {proposal.unsupportedCapabilities.map((finding) => (
                  <p key={finding}>{finding}</p>
                ))}
              </div>
            )}
            {proposal.operations.map((operation) => (
              <article key={operation.id} className={styles.changeCard}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(operation.id)}
                    disabled={stale || working}
                    onChange={(event) => {
                      const ids = event.target.checked
                        ? [...selectedIds, operation.id]
                        : selectedIds.filter((id) => id !== operation.id);
                      setSelectedIds(ids);
                      if (previewing) void showPreview(ids);
                    }}
                  />
                  <span>
                    <small>{operationTitle(operation)}</small>
                    <strong>{operationDescription(operation, props.draft)}</strong>
                  </span>
                </label>
                {"entityId" in operation && operation.type !== "DELETE" && (
                  <button
                    className={styles.linkButton}
                    disabled={stale || working || (operation.type === "CREATE" && !selectedIds.includes(operation.id))}
                    onClick={() =>
                      void showPreview(selectedIds).then((shown) => {
                        if (shown) latest.current.onSelect(operation.entityId);
                      })
                    }
                  >
                    Locate object
                  </button>
                )}
                {operation.type === "CREATE" && (
                  <details>
                    <summary>Clue & accessible description</summary>
                    <p>{operation.content}</p>
                    <p>{operation.alternativeText}</p>
                  </details>
                )}
              </article>
            ))}
            <details className={styles.reviewDetails}>
              <summary>Details &amp; considerations</summary>
              <p>{proposal.creatorExplanation}</p>
              {[...proposal.warnings, ...proposal.accessibilityNotes].map((finding, index) => (
                <p key={`${index}:${finding}`}>{finding}</p>
              ))}
              <ul>
                {proposal.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
              {proposal.operations.map((operation) => (
                <p key={operation.id}>
                  {operation.explanation}
                  {operation.dependsOn.length ? " Related changes are included when applied together." : ""}
                </p>
              ))}
            </details>
            {proposal.operations.length > 0 && (
              <>
                <div className={styles.previewSwitch}>
                  <button
                    disabled={stale || working}
                    aria-pressed={!previewing}
                    onClick={() => void showPreview(selectedIds, false)}
                  >
                    Current scene
                  </button>
                  <button
                    disabled={stale || working || !selectedIds.length}
                    aria-pressed={previewing}
                    onClick={() => void showPreview(selectedIds)}
                  >
                    Proposed scene
                  </button>
                </div>
                <div className={styles.applyBar}>
                  <button
                    className={styles.primary}
                    disabled={stale || working || !selectedIds.length}
                    onClick={() => void apply()}
                  >
                    {stage === "APPLYING"
                      ? "Saving…"
                      : selectedIds.length === proposal.operations.length
                        ? "Apply all changes"
                        : `Apply ${selectedIds.length} selected changes`}
                  </button>
                  <button
                    disabled={working}
                    onClick={() => {
                      void props.port
                        .reportOutcome?.(proposal.requestId, "REJECTED")
                        .catch(() => setNotice("Your scene is unchanged; rejection feedback could not be recorded."));
                      setSentRequest("");
                      setCurrentResponse(null);
                      setConversation([]);
                      props.onPreview(null, []);
                      setPreviewing(false);
                      setProposal(null);
                      setStage("IDLE");
                    }}
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
            <button
              className={styles.linkButton}
              onClick={() => {
                setComposer("");
                input.current?.focus();
              }}
            >
              Refine this proposal
            </button>
          </motion.section>
        )}
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerMeta}>
          <div className={styles.usage}>
            <details>
              <summary>
                {usage.remaining.toLocaleString()} of {usage.allowance.toLocaleString()} requests remaining
              </summary>
              <p>
                {usage.used} requests used. Your allowance{" "}
                {usage.source === "OVERRIDE" ? "uses an approved individual policy" : "inherits platform defaults"}.
              </p>
              <p>Resets {new Date(usage.resetAt).toLocaleString()}.</p>
              <p>
                {usage.advancedEnabled
                  ? "Advanced assistance is available when you select it."
                  : "Advanced assistance is unavailable for this account."}
              </p>
            </details>
            {usage.advancedEnabled && (
              <label>
                <input
                  type="checkbox"
                  checked={advanced}
                  disabled={working}
                  onChange={(event) => setAdvanced(event.target.checked)}
                />
                Advanced
              </label>
            )}
          </div>
          <div className={styles.history}>
            <button
              disabled={!props.canUndo || working}
              onClick={() => {
                props.onPreview(null, []);
                setProposal(null);
                void Promise.resolve(props.onUndo())
                  .then(() => {
                    setStage("IDLE");
                    setNotice("Editor change undone.");
                  })
                  .catch(() => setNotice("Undo could not finish."));
              }}
            >
              Undo
            </button>
            <button
              disabled={!props.canRedo || working}
              onClick={() => {
                props.onPreview(null, []);
                setProposal(null);
                void Promise.resolve(props.onRedo())
                  .then(() => {
                    setStage("IDLE");
                    setNotice("Editor change restored.");
                  })
                  .catch(() => setNotice("Redo could not finish."));
              }}
            >
              Redo
            </button>
          </div>
        </div>
        {(!usage.enabled || usage.remaining === 0 || usage.nearingLimit) && (
          <p className={styles.notice}>
            {!usage.enabled
              ? "Spatial Assistant is unavailable. Your scenes are safe, and you can keep editing manually."
              : usage.remaining === 0
                ? "Monthly allowance reached. Manual editing remains available."
                : "You’re nearing this month’s allowance."}
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className={styles.srOnly} htmlFor={`assistant-request-${props.draft.content.definitionId}`}>
            Describe your spatial idea
          </label>
          <textarea
            ref={input}
            id={`assistant-request-${props.draft.content.definitionId}`}
            rows={3}
            maxLength={2000}
            value={composer}
            placeholder={selected ? `Describe a change to ${selected.name}…` : "Describe the scene you imagine…"}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className={styles.composerActions}>
            <small>
              Enter to send · Shift+Enter for a new line
              <br />
              {composer.length}/2,000
            </small>
            <button
              type="button"
              disabled={stage === "APPLYING"}
              onClick={() => {
                requestGeneration.current++;
                controller.current?.abort();
                controller.current = null;
                setSentRequest("");
                setCurrentResponse(null);
                setConversation([]);
                setPreviousRequestId(null);
                setRestored(false);
                setComposer("");
                setProposal(null);
                props.onPreview(null, []);
                setPreviewing(false);
                setStage("IDLE");
                setNotice("New task started. I’ll use your current saved scene.");
                try {
                  sessionStorage.removeItem(sessionKey);
                } catch {}
                input.current?.focus();
              }}
            >
              Start new task
            </button>
            {working && stage !== "APPLYING" ? (
              <button
                key="cancel-request"
                type="button"
                onClick={(event) => {
                  // Do not submit when this click replaces Cancel with Send.
                  event.preventDefault();
                  requestGeneration.current++;
                  controller.current?.abort();
                  controller.current = null;
                  setSentRequest("");
                  setCurrentResponse(null);
                  setConversation([]);
                  setStage("CANCELLED");
                  setNotice("Assistance cancelled. Your scene is unchanged.");
                  input.current?.focus();
                }}
              >
                Cancel request
              </button>
            ) : (
              <button
                key="send-request"
                type="submit"
                className={styles.primary}
                disabled={!composer.trim() || working || !usage.enabled}
              >
                Send idea <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </form>
      </footer>
    </aside>
  );
}

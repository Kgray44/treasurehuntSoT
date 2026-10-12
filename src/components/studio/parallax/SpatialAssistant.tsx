"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import type { SpatialDraft } from "@/parallax/authoring";
import { spatialId } from "@/parallax/contracts";
import {
  assistantProposalSchema,
  materializeAssistantProposal,
  type AssistantProposal,
  type AssistantOperation,
} from "@/parallax/spatial-assistant";
import type { AssistantRequest } from "@/parallax/spatial-assistant-service";
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
  prepareBase: () => Promise<SpatialAssistantBase>;
  request: (input: AssistantRequest, signal: AbortSignal) => Promise<SpatialAssistantReply>;
  apply: (
    proposal: AssistantProposal,
    selectedOperationIds: readonly string[],
    idempotencyKey: string,
  ) => Promise<SpatialAssistantSavedDraft>;
};
export type SpatialAssistantProps = {
  draft: SpatialDraft;
  revision: number;
  editorGeneration: number;
  selectedEntityId: string | null;
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
  return {
    CREATE: "New spatial object",
    CONTENT: "Object details",
    PLACEMENT: "Placement",
    SEMANTIC_PLACEMENT: "Adaptive placement",
    TRANSFORM: "Position & scale",
    VISIBILITY: "Visibility",
    BEHAVIOR: "Interaction & timing",
    FALLBACK: "Guided accessibility",
  }[operation.type];
}
function operationDescription(operation: AssistantOperation, draft: SpatialDraft) {
  const name =
    "entityId" in operation
      ? (draft.content.entities.find((entity) => entity.id === operation.entityId)?.name ??
        (operation.type === "CREATE" ? operation.name : "Proposed object"))
      : "Guided experience";
  switch (operation.type) {
    case "CREATE":
      return `${operation.name} · ${operation.placement === "DESK" ? "on a horizontal surface" : operation.placement === "WALL" ? "on a wall" : operation.placement === "ENTRANCE" ? "near the entrance" : "in the local scene"}`;
    case "PLACEMENT":
      return `${name} · ${operation.placement.toLowerCase()}`;
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
    if (shownNotice && (stage === "FAILED" || stage === "UNAVAILABLE") && body.current) body.current.scrollTop = 0;
  }, [shownNotice, stage]);
  function affected(ids: readonly string[]) {
    return [
      ...new Set(
        (proposal?.operations ?? [])
          .filter((operation) => ids.includes(operation.id))
          .flatMap((operation) =>
            "entityId" in operation
              ? [operation.entityId]
              : operation.type === "BEHAVIOR"
                ? [operation.targetEntityId]
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
    const generation = ++requestGeneration.current,
      abort = new AbortController();
    controller.current = abort;
    setNotice("");
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
          request: composer.trim(),
          selectedEntityId: latest.current.selectedEntityId,
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
      <header className={styles.header}>
        <div className={styles.emblem}>
          <SuggestionIcon kind="spark" />
        </div>
        <div>
          <p>PARALLAX</p>
          <h2>Spatial Assistant</h2>
        </div>
        <button
          aria-label="Collapse Spatial Assistant"
          aria-expanded="true"
          onClick={() => {
            props.onPreview(null, []);
            setPreviewing(false);
            setCollapsed(true);
            props.onClose?.();
          }}
        >
          −
        </button>
      </header>
      <div className={styles.context}>
        <span className={styles.contextDot} aria-hidden="true" />
        <span>{selected ? selected.name : "Whole scene"}</span>
        <small>{props.draft.content.entities.length} objects</small>
        {props.onCanvasView && <button onClick={props.onCanvasView}>View canvas</button>}
      </div>
      <div className={styles.body} ref={body}>
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
        <p className={styles.activity} role="status" aria-live="polite" data-working={working}>
          <span aria-hidden="true">{working ? "◌" : stage === "ACCEPTED" ? "✓" : "✦"}</span>
          {stageText[stage]}
        </p>
        {shownNotice && (
          <p className={styles.notice} role="status">
            {shownNotice}
          </p>
        )}
        {proposal && (
          <section className={styles.proposal} ref={review} tabIndex={-1} aria-label="Review spatial proposal">
            <span className={styles.kicker}>PROPOSED EXPERIENCE</span>
            <h3>{proposal.summary}</h3>
            <p>{proposal.creatorExplanation}</p>
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
                <p>{operation.explanation}</p>
                {operation.dependsOn.length > 0 && <small>Includes related changes when applied as a bundle.</small>}
                {"entityId" in operation && (
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
            {[...proposal.warnings, ...proposal.accessibilityNotes].map((finding, index) => (
              <p className={styles.finding} key={`${index}:${finding}`}>
                {finding}
              </p>
            ))}
            {proposal.assumptions.length > 0 && (
              <details>
                <summary>Assumptions to review</summary>
                <ul>
                  {proposal.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </details>
            )}
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
                <p className={styles.reassurance}>Review changes in your scene before you apply them.</p>
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
          </section>
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
              disabled={working}
              onClick={() => {
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
                type="button"
                onClick={() => {
                  controller.current?.abort();
                  setStage("IDLE");
                  setNotice("Assistance cancelled. Your scene is unchanged.");
                }}
              >
                Cancel request
              </button>
            ) : (
              <button type="submit" className={styles.primary} disabled={!composer.trim() || working || !usage.enabled}>
                Send idea <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </form>
      </footer>
    </aside>
  );
}

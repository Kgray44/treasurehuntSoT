"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type Ref } from "react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration, type SceneHostProps } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import type { Phase3PlayerProgressEventType } from "./contracts";
import styles from "./ProgressionSceneHost.module.css";

export const progressionSceneHostKey = "player-progression";

export type ProgressionSceneAction = Readonly<{
  label: string;
  onActivate: () => void;
  disabled?: boolean;
}>;

export type ProgressionSceneHostProps = Readonly<{
  /** Persistent application content owned by this one Player progression boundary. */
  content: ReactNode;
  /** The boundary and content stay mounted when false; only the fixed presentation overlay becomes hidden and inert. */
  active: boolean;
  presentationId?: string | null;
  eventType?: Phase3PlayerProgressEventType | string | null;
  status: string;
  title: string;
  summary: ReactNode;
  announcement?: string;
  politeness?: "polite" | "assertive" | "off";
  busy?: boolean;
  skip?: ProgressionSceneAction;
  replay?: ProgressionSceneAction;
  destination?: ProgressionSceneAction;
  fallback?: ReactNode;
  children?: ReactNode;
  onHostChange?: (host: SceneHostHandle | null) => void;
  as?: SceneHostProps["as"];
  className?: string;
}>;

type TargetDefinition = Readonly<{
  key: string;
  part: string;
  allowedProperties: readonly AnimatedProperty[];
}>;

const target = (key: string, part: string, allowedProperties: readonly AnimatedProperty[]): TargetDefinition =>
  Object.freeze({ key, part, allowedProperties: Object.freeze([...allowedProperties]) });

const targets = Object.freeze({
  workspaceLight: target("workspace-light", "workspace-light", ["opacity"]),
  journalStage: target("journal-stage", "journal-stage", ["transform"]),
  sealedParchment: target("sealed-parchment", "sealed-parchment", ["transform"]),
  inkHeading: target("ink-heading", "ink-heading", ["transform", "opacity"]),
  inkStory: target("ink-story", "ink-story", ["transform", "opacity", "filter"]),
  inkObjective: target("ink-objective", "ink-objective", ["transform", "opacity"]),
  inkRiddle: target("ink-riddle", "ink-riddle", ["clip-path", "opacity"]),
  seal: target("seal", "seal", ["transform"]),
  sealCrackOne: target("seal-crack-one", "seal-crack", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
  sealCrackTwo: target("seal-crack-two", "seal-crack", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
  sealFragmentOne: target("seal-fragment-one", "seal-fragment", ["transform", "opacity"]),
  sealFragmentTwo: target("seal-fragment-two", "seal-fragment", ["transform", "opacity"]),
  pageLight: target("page-light", "page-light", ["transform", "opacity"]),
  routePath: target("route-path", "route-path", ["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"]),
  mapFog: target("map-fog", "map-fog", ["transform", "opacity", "clip-path"]),
  quill: target("quill", "quill", ["transform", "opacity"]),
  quillPath: target("quill-path", "quill-path", ["path-drawing"]),
  lantern: target("lantern", "lantern", ["transform", "opacity"]),
  mapMarker: target("map-marker-new", "map-marker", ["transform", "opacity"]),
  artifactReveal: target("artifact-reveal", "artifact-reveal", ["transform", "opacity"]),
  artifactSlot: target("artifact-slot-target", "artifact-slot-target", []),
  artifactLight: target("artifact-light", "artifact-light", ["transform", "opacity"]),
  artifactConnection: target("artifact-connection-path", "artifact-connection-path", [
    "path-drawing",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
  ]),
  questNote: target("quest-note-new", "quest-note-new", ["transform", "opacity"]),
  redThread: target("red-thread", "red-thread", ["path-drawing", "stroke-dasharray", "stroke-dashoffset"]),
  questStamp: target("quest-stamp", "quest-stamp", ["transform", "opacity"]),
  logEntry: target("log-entry-new", "log-entry-new", ["opacity", "clip-path", "filter"]),
  logSymbol: target("log-symbol-new", "log-symbol-new", ["transform", "opacity"]),
  finaleOuter: target("finale-ring-outer", "finale-ring-outer", ["transform"]),
  finaleInner: target("finale-ring-inner", "finale-ring-inner", ["transform"]),
  finalePath: target("finale-light-path", "finale-light-path", [
    "path-drawing",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
  ]),
  solvedStamp: target("solved-stamp", "solved-stamp", ["transform", "opacity"]),
  undoMark: target("undo-mark", "undo-mark", ["transform", "opacity"]),
});

const chapterTargetParts = [
  "workspace-light",
  "journal-stage",
  "sealed-parchment",
  "ink-heading",
  "ink-story",
  "ink-objective",
  "ink-riddle",
  "seal",
  "seal-crack",
  "seal-fragment",
  "page-light",
  "route-path",
  "map-fog",
  "quill",
  "quill-path",
  "lantern",
] as const;

export const progressionRelevantTargetParts = Object.freeze({
  CHAPTER_RELEASED: chapterTargetParts,
  CHAPTER_SOLVED: ["workspace-light", "solved-stamp"],
  ARTIFACT_AWARDED: ["workspace-light", "artifact-reveal", "artifact-slot-target", "artifact-light"],
  ARTIFACT_SILHOUETTE_REVEALED: ["workspace-light", "artifact-reveal", "artifact-slot-target", "artifact-light"],
  ARTIFACT_CONNECTED: ["workspace-light", "artifact-connection-path"],
  MAP_LOCATION_REVEALED: ["workspace-light", "map-marker", "map-fog", "route-path"],
  MAP_ROUTE_REVEALED: ["workspace-light", "route-path"],
  SIDE_QUEST_DISCOVERED: ["workspace-light", "quest-note-new", "red-thread"],
  SIDE_QUEST_UPDATED: ["workspace-light", "quest-note-new", "red-thread"],
  SIDE_QUEST_COMPLETED: ["workspace-light", "quest-note-new", "red-thread", "quest-stamp"],
  JOURNAL_ANNOTATION_ADDED: ["workspace-light", "log-entry-new", "log-symbol-new"],
  PLAYER_LOG_ENTRY_ADDED: ["workspace-light", "log-entry-new", "log-symbol-new"],
  FINALE_TEASED: ["workspace-light", "finale-ring-outer", "finale-ring-inner", "finale-light-path"],
  FINALE_REQUIREMENT_UPDATED: ["workspace-light", "finale-ring-outer", "finale-ring-inner", "finale-light-path"],
  CAMPAIGN_PAUSED: ["workspace-light", "lantern"],
  CAMPAIGN_RESUMED: ["workspace-light", "lantern"],
  STATE_REVERTED: ["workspace-light", "undo-mark"],
} as const satisfies Readonly<Record<Phase3PlayerProgressEventType, readonly string[]>>);

export const progressionSceneTargetParts = Object.freeze(
  [...new Set(Object.values(targets).map(({ part }) => part))].sort(),
);

const noRelevantTargetParts: readonly string[] = Object.freeze([]);

function relevantTargetPartsFor(eventType: ProgressionSceneHostProps["eventType"]): readonly string[] {
  if (!eventType || !Object.prototype.hasOwnProperty.call(progressionRelevantTargetParts, eventType)) {
    return noRelevantTargetParts;
  }
  return progressionRelevantTargetParts[eventType as Phase3PlayerProgressEventType];
}

function isAvailableOverlayControl(control: HTMLButtonElement | null): control is HTMLButtonElement {
  if (!control || control.disabled || control.hidden || control.getAttribute("aria-hidden") === "true") return false;
  const style = control.ownerDocument.defaultView?.getComputedStyle(control);
  return style?.display !== "none" && style?.visibility !== "hidden" && style?.visibility !== "collapse";
}

function SceneHostHandleBridge({ onChange }: { onChange?: (host: SceneHostHandle | null) => void }) {
  const host = useOptionalSceneHost();
  useEffect(() => {
    onChange?.(host);
    return () => onChange?.(null);
  }, [host, onChange]);
  return null;
}

function useTarget(definition: TargetDefinition) {
  const input = useMemo(
    () => ({
      targetKey: `progression-host:${definition.key}`,
      part: definition.part,
      ownerHint: "gsap" as const,
      allowedProperties: definition.allowedProperties,
    }),
    [definition],
  );
  return useSceneTargetRegistration(input).bindTarget;
}

type PresentationRelevance = "relevant" | "neutral";

function targetRelevance(definition: TargetDefinition, relevantParts: ReadonlySet<string>): PresentationRelevance {
  return relevantParts.has(definition.part) ? "relevant" : "neutral";
}

function DivTarget({
  definition,
  relevantParts,
  className,
  dimWhenNeutral = true,
}: {
  definition: TargetDefinition;
  relevantParts: ReadonlySet<string>;
  className?: string;
  dimWhenNeutral?: boolean;
}) {
  const bindTarget = useTarget(definition);
  return (
    <div
      ref={bindTarget}
      className={className}
      data-scene-part={definition.part}
      data-presentation-relevance={targetRelevance(definition, relevantParts)}
      data-neutral-visibility={dimWhenNeutral ? "dim" : undefined}
      data-gsap-owned
      aria-hidden="true"
    />
  );
}

function PathTarget({
  definition,
  relevantParts,
  d,
  className,
  dimWhenNeutral = true,
}: {
  definition: TargetDefinition;
  relevantParts: ReadonlySet<string>;
  d: string;
  className?: string;
  dimWhenNeutral?: boolean;
}) {
  const bindTarget = useTarget(definition);
  return (
    <path
      ref={bindTarget}
      className={className}
      data-scene-part={definition.part}
      data-presentation-relevance={targetRelevance(definition, relevantParts)}
      data-neutral-visibility={dimWhenNeutral ? "dim" : undefined}
      data-gsap-owned
      aria-hidden="true"
      d={d}
    />
  );
}

function CeremonyTargets({
  title,
  summary,
  relevantParts,
}: {
  title: string;
  summary: ReactNode;
  relevantParts: ReadonlySet<string>;
}) {
  const bindWorkspaceLight = useTarget(targets.workspaceLight);
  const bindJournalStage = useTarget(targets.journalStage);
  const bindParchment = useTarget(targets.sealedParchment);
  const bindHeading = useTarget(targets.inkHeading);
  const bindStory = useTarget(targets.inkStory);
  const bindObjective = useTarget(targets.inkObjective);
  const bindRiddle = useTarget(targets.inkRiddle);
  const bindLantern = useTarget(targets.lantern);

  return (
    <>
      <div
        ref={bindWorkspaceLight}
        className={styles.backdropLayer}
        data-progression-layer="backdrop"
        data-runtime-owner="gsap"
        data-scene-part="workspace-light"
        data-presentation-relevance={targetRelevance(targets.workspaceLight, relevantParts)}
        data-neutral-visibility="dim"
        data-gsap-owned
        aria-hidden="true"
      />

      <div
        ref={bindJournalStage}
        className={styles.primaryLayer}
        data-progression-layer="primary"
        data-runtime-owner="gsap"
        data-scene-part="journal-stage"
        data-presentation-relevance={targetRelevance(targets.journalStage, relevantParts)}
        data-gsap-owned
        aria-hidden="true"
      >
        <div
          ref={bindParchment}
          className={styles.parchment}
          data-scene-part="sealed-parchment"
          data-presentation-relevance={targetRelevance(targets.sealedParchment, relevantParts)}
          data-neutral-visibility="dim"
          data-gsap-owned
          aria-hidden="true"
        >
          <DivTarget
            definition={targets.pageLight}
            relevantParts={relevantParts}
            className={styles.pageLight}
            dimWhenNeutral={false}
          />
          <div className={styles.sealGroup} aria-hidden="true">
            <DivTarget
              definition={targets.seal}
              relevantParts={relevantParts}
              className={styles.seal}
              dimWhenNeutral={false}
            />
            <svg className={styles.sealCracks} viewBox="0 0 120 120" aria-hidden="true">
              <PathTarget
                definition={targets.sealCrackOne}
                relevantParts={relevantParts}
                d="M58 8L50 48 66 60 42 92"
                dimWhenNeutral={false}
              />
              <PathTarget
                definition={targets.sealCrackTwo}
                relevantParts={relevantParts}
                d="M62 12L70 42 58 62 80 104"
                dimWhenNeutral={false}
              />
            </svg>
            <DivTarget
              definition={targets.sealFragmentOne}
              relevantParts={relevantParts}
              className={styles.sealFragmentOne}
              dimWhenNeutral={false}
            />
            <DivTarget
              definition={targets.sealFragmentTwo}
              relevantParts={relevantParts}
              className={styles.sealFragmentTwo}
              dimWhenNeutral={false}
            />
          </div>
          <div
            ref={bindHeading}
            data-scene-part="ink-heading"
            data-presentation-relevance={targetRelevance(targets.inkHeading, relevantParts)}
            data-gsap-owned
            aria-hidden="true"
          >
            {title}
          </div>
          <div
            ref={bindStory}
            data-scene-part="ink-story"
            data-presentation-relevance={targetRelevance(targets.inkStory, relevantParts)}
            data-gsap-owned
            aria-hidden="true"
          >
            {summary}
          </div>
          <div
            ref={bindObjective}
            className={styles.semanticTarget}
            data-scene-part="ink-objective"
            data-presentation-relevance={targetRelevance(targets.inkObjective, relevantParts)}
            data-gsap-owned
            aria-hidden="true"
          />
          <div
            ref={bindRiddle}
            className={styles.semanticTarget}
            data-scene-part="ink-riddle"
            data-presentation-relevance={targetRelevance(targets.inkRiddle, relevantParts)}
            data-gsap-owned
            aria-hidden="true"
          />
          <svg className={styles.inkPaths} viewBox="0 0 440 120" aria-hidden="true">
            <PathTarget
              definition={targets.quillPath}
              relevantParts={relevantParts}
              d="M20 92C138 34 300 24 418 42"
              dimWhenNeutral={false}
            />
          </svg>
          <DivTarget
            definition={targets.quill}
            relevantParts={relevantParts}
            className={styles.quill}
            dimWhenNeutral={false}
          />
        </div>
        <svg className={styles.globalMapPath} viewBox="0 0 440 120" aria-hidden="true">
          <PathTarget definition={targets.routePath} relevantParts={relevantParts} d="M12 78C122 8 286 16 428 72" />
        </svg>
        <DivTarget definition={targets.mapFog} relevantParts={relevantParts} className={styles.mapFog} />
      </div>

      <div
        ref={bindLantern}
        className={styles.lantern}
        data-scene-part="lantern"
        data-presentation-relevance={targetRelevance(targets.lantern, relevantParts)}
        data-neutral-visibility="dim"
        data-gsap-owned
        aria-hidden="true"
      />
    </>
  );
}

function EventObjectTargets({
  children,
  relevantParts,
  eventKnown,
}: {
  children?: ReactNode;
  relevantParts: ReadonlySet<string>;
  eventKnown: boolean;
}) {
  return (
    <div className={styles.objectLayer} data-progression-layer="object" data-runtime-owner="gsap" aria-hidden="true">
      <DivTarget definition={targets.mapMarker} relevantParts={relevantParts} className={styles.marker} />
      <DivTarget definition={targets.artifactReveal} relevantParts={relevantParts} className={styles.artifact} />
      <DivTarget definition={targets.artifactSlot} relevantParts={relevantParts} className={styles.artifactSlot} />
      <DivTarget definition={targets.artifactLight} relevantParts={relevantParts} className={styles.artifactLight} />
      <svg className={styles.connectionPaths} viewBox="0 0 440 180" aria-hidden="true">
        <PathTarget definition={targets.artifactConnection} relevantParts={relevantParts} d="M18 142Q220 18 422 142" />
        <PathTarget definition={targets.redThread} relevantParts={relevantParts} d="M18 154C128 12 306 18 422 152" />
        <PathTarget definition={targets.finalePath} relevantParts={relevantParts} d="M220 8L426 90 220 172 14 90z" />
      </svg>
      <DivTarget definition={targets.questNote} relevantParts={relevantParts} className={styles.questNote} />
      <DivTarget definition={targets.questStamp} relevantParts={relevantParts} className={styles.questStamp} />
      <DivTarget definition={targets.logEntry} relevantParts={relevantParts} className={styles.logEntry} />
      <DivTarget definition={targets.logSymbol} relevantParts={relevantParts} className={styles.logSymbol} />
      <DivTarget definition={targets.finaleOuter} relevantParts={relevantParts} className={styles.finaleOuter} />
      <DivTarget definition={targets.finaleInner} relevantParts={relevantParts} className={styles.finaleInner} />
      <DivTarget definition={targets.solvedStamp} relevantParts={relevantParts} className={styles.solvedStamp} />
      <DivTarget definition={targets.undoMark} relevantParts={relevantParts} className={styles.undoMark} />
      <div
        className={styles.eventChildren}
        data-presentation-event-children
        data-presentation-relevance={eventKnown ? "relevant" : "neutral"}
        data-neutral-visibility="dim"
      >
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  kind,
  buttonRef,
}: {
  action: ProgressionSceneAction;
  kind: "skip" | "replay" | "destination";
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={action.disabled}
      onClick={action.onActivate}
      data-progression-action={kind}
    >
      {action.label}
    </button>
  );
}

export function ProgressionSceneHost({
  content,
  active,
  presentationId,
  eventType,
  status,
  title,
  summary,
  announcement = "",
  politeness = "polite",
  busy = false,
  skip,
  replay,
  destination,
  fallback,
  children,
  onHostChange,
  as = "div",
  className,
}: ProgressionSceneHostProps) {
  const headingId = "player-progression-heading";
  const summaryId = "player-progression-summary";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const destinationRef = useRef<HTMLButtonElement>(null);
  const wasActive = useRef(false);
  const activeRequestIdentity = useRef<string | null>(null);
  const skipEnabled = Boolean(skip && !skip.disabled);
  const replayEnabled = Boolean(replay && !replay.disabled);
  const destinationEnabled = Boolean(destination && !destination.disabled);
  const mappedTargetParts = relevantTargetPartsFor(eventType);
  const relevantParts = useMemo(() => new Set(mappedTargetParts), [mappedTargetParts]);
  const eventKnown = mappedTargetParts !== noRelevantTargetParts;
  const requestIdentity = `${presentationId ?? ""}\u0000${eventType ?? ""}`;
  const liveRegionProps =
    politeness === "assertive"
      ? ({ role: "alert", "aria-live": "assertive" } as const)
      : politeness === "polite"
        ? ({ role: "status", "aria-live": "polite" } as const)
        : {};

  const focusTargets = useCallback((): HTMLElement[] => {
    const controls = [
      skipEnabled && isAvailableOverlayControl(skipRef.current) ? skipRef.current : null,
      replayEnabled && isAvailableOverlayControl(replayRef.current) ? replayRef.current : null,
      destinationEnabled && isAvailableOverlayControl(destinationRef.current) ? destinationRef.current : null,
    ].filter((candidate): candidate is HTMLButtonElement => candidate !== null);
    if (controls.length > 0) return controls;
    return headingRef.current ? [headingRef.current] : [];
  }, [destinationEnabled, replayEnabled, skipEnabled]);

  useLayoutEffect(() => {
    const activating = active && !wasActive.current;
    const replacingRequest =
      active && activeRequestIdentity.current !== null && activeRequestIdentity.current !== requestIdentity;
    wasActive.current = active;
    activeRequestIdentity.current = active ? requestIdentity : null;
    if (!active) return;
    const targets = focusTargets();
    const current = document.activeElement;
    const currentIsContainedTarget = current instanceof HTMLElement && targets.includes(current);
    if (activating || replacingRequest || !currentIsContainedTarget) {
      targets[0]?.focus({ preventScroll: true });
    }
  }, [active, focusTargets, requestIdentity]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!active || !overlay) return;
    const ownerDocument = overlay.ownerDocument;
    const focusFirst = () => focusTargets()[0]?.focus({ preventScroll: true });
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && overlay.contains(target)) return;
      focusFirst();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Tab") return;
      const targets = focusTargets();
      if (targets.length === 0) return;
      const currentIndex = targets.indexOf(ownerDocument.activeElement as HTMLElement);
      const wrapsBackward = event.shiftKey && currentIndex <= 0;
      const wrapsForward = !event.shiftKey && (currentIndex === -1 || currentIndex === targets.length - 1);
      if (!wrapsBackward && !wrapsForward) return;
      event.preventDefault();
      targets[event.shiftKey ? targets.length - 1 : 0]?.focus({ preventScroll: true });
    };
    ownerDocument.addEventListener("focusin", handleFocusIn);
    ownerDocument.addEventListener("keydown", handleKeyDown);
    return () => {
      ownerDocument.removeEventListener("focusin", handleFocusIn);
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, eventType, focusTargets, presentationId]);

  return (
    <SceneHost
      kind="player-progression"
      hostKey={progressionSceneHostKey}
      as={as}
      className={[styles.host, className].filter(Boolean).join(" ")}
      data-progression-scene-host
      data-testid="progression-scene-host"
    >
      <SceneHostHandleBridge onChange={onHostChange} />
      <div
        className={styles.content}
        data-progression-content
        data-testid="progression-content"
        aria-hidden={active ? true : undefined}
        inert={active ? true : undefined}
      >
        {content}
      </div>
      <div
        ref={overlayRef}
        className={styles.overlay}
        data-progression-overlay
        data-progression-state={active ? "active" : "inactive"}
        data-presentation-id={presentationId ?? undefined}
        data-presentation-event={eventType ?? undefined}
        data-presentation-status={status}
        data-testid="progression-scene-overlay"
        role="dialog"
        aria-modal={active ? true : undefined}
        aria-labelledby={headingId}
        aria-describedby={summaryId}
        aria-busy={busy}
        aria-hidden={active ? undefined : true}
        hidden={!active}
        inert={!active ? true : undefined}
      >
        <CeremonyTargets title={title} summary={summary} relevantParts={relevantParts} />
        <EventObjectTargets relevantParts={relevantParts} eventKnown={eventKnown}>
          {children}
        </EventObjectTargets>

        <section className={styles.summaryLayer} data-progression-layer="summary" data-runtime-owner="react">
          <h2 ref={headingRef} id={headingId} tabIndex={-1}>
            {title}
          </h2>
          <div id={summaryId}>{summary}</div>
        </section>

        {(skip || replay || destination) && (
          <div
            className={styles.controlsLayer}
            data-progression-layer="controls"
            data-runtime-owner="react"
            role="group"
            aria-label="Presentation controls"
          >
            {skip && <ActionButton action={skip} kind="skip" buttonRef={skipRef} />}
            {replay && <ActionButton action={replay} kind="replay" buttonRef={replayRef} />}
            {destination && <ActionButton action={destination} kind="destination" buttonRef={destinationRef} />}
          </div>
        )}

        <div
          className={styles.liveRegion}
          data-progression-layer="live-region"
          data-runtime-owner="react"
          aria-atomic="true"
          {...liveRegionProps}
        >
          {active && politeness !== "off" ? announcement : ""}
        </div>

        {fallback !== undefined && fallback !== null && (
          <div className={styles.fallbackLayer} data-progression-layer="fallback" data-runtime-owner="react">
            {fallback}
          </div>
        )}
      </div>
    </SceneHost>
  );
}

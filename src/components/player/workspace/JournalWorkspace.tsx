"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import {
  buildJournalPages,
  pageIndexForAnnotation,
  pageIndexForChapter,
  type JournalPage,
} from "@/animation/journal/page-model";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import type {
  FlipBookPage,
  PageFlipBookHandle,
  PageFlipPageTargetExportAuthority,
} from "@/components/animation/PageFlipBook";
import type { PageFlipPageTargetCapability } from "@/components/animation/pageflip-boundary";
import { LottieEffect, type LottieEffectHandle } from "@/components/animation/LottieEffect";
import { RiveStatefulObject, type RiveRuntimeStatus } from "@/components/animation/RiveStatefulObject";
import { journalClaspOpeningPhase, riveAssets } from "@/animation/assets/rive-contracts";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import type { JournalOpeningPhase } from "@/animation/journal/opening-machine";
import { PhysicalJournalBook } from "@/components/player/journal/PhysicalJournalBook";

export type JournalCeremonyTargetKey =
  | "journal-stage"
  | "sealed-parchment"
  | "ink-heading"
  | "ink-story"
  | "ink-objective"
  | "ink-riddle"
  | "page-light"
  | "seal"
  | "seal-crack"
  | "seal-fragment"
  | "route-path"
  | "map-fog"
  | "quill"
  | "quill-path";

export type JournalCeremonyTargetReady = Readonly<{
  host: SceneHostHandle;
  targets: Readonly<Record<JournalCeremonyTargetKey, readonly SceneTargetHandle[]>>;
}>;

export type JournalAnnotationTargetReady = Readonly<{
  eventId: string;
  annotationKey: string;
  chapterOrdinal: number;
  pageId: string;
  pageIndex: number;
  authority: PageFlipPageTargetExportAuthority;
  target: PageFlipPageTargetCapability;
}>;

export type JournalChapterInkCommand = Readonly<{
  eventId: string;
  semanticLabel: "ink-story";
  play: () => void;
  stop: () => void;
}>;

type JournalClaspPose = "locked" | "awake" | "releasing" | "opening" | "open";

const journalClaspPoseByPhase = {
  ENTRY_IDLE: "locked",
  ENTRY_ACTIVATED: "locked",
  CLOSED_BOOK_REVEAL: "locked",
  LATCH_RELEASING: "releasing",
  COVER_OPENING: "opening",
  SEALED_PAGE_REVEAL: "opening",
  SEAL_BREAKING: "opening",
  BOOK_SETTLING: "opening",
  JOURNAL_READY: "open",
} as const satisfies Record<JournalOpeningPhase, JournalClaspPose>;

const journalClaspReadableState = {
  locked: "The journal clasp is locked.",
  awake: "The journal clasp is awake and ready to release.",
  releasing: "The journal clasp is releasing while the journal cover remains supported.",
  opening: "The journal clasp is released while the journal opens.",
  open: "The journal clasp is open and the readable journal is ready.",
} as const satisfies Record<JournalClaspPose, string>;

type CeremonyOverlayTargetHandles = Omit<JournalCeremonyTargetReady["targets"], "journal-stage">;

const ceremonyTargetRegistrations = {
  sealedParchment: {
    targetKey: "chapter-ceremony:sealed-parchment",
    part: "sealed-parchment",
    ownerHint: "gsap",
    allowedProperties: ["transform"],
  },
  inkHeadingEyebrow: {
    targetKey: "chapter-ceremony:ink-heading-eyebrow",
    part: "ink-heading",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  inkHeadingTitle: {
    targetKey: "chapter-ceremony:ink-heading-title",
    part: "ink-heading",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  inkStory: {
    targetKey: "chapter-ceremony:ink-story",
    part: "ink-story",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity", "filter"],
  },
  inkObjective: {
    targetKey: "chapter-ceremony:ink-objective",
    part: "ink-objective",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  inkRiddle: {
    targetKey: "chapter-ceremony:ink-riddle",
    part: "ink-riddle",
    ownerHint: "gsap",
    allowedProperties: ["clip-path", "opacity"],
  },
  pageLight: {
    targetKey: "chapter-ceremony:page-light",
    part: "page-light",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  seal: {
    targetKey: "chapter-ceremony:seal",
    part: "seal",
    ownerHint: "gsap",
    allowedProperties: ["transform"],
  },
  sealCrack: {
    targetKey: "chapter-ceremony:seal-crack-1",
    part: "seal-crack",
    ownerHint: "gsap",
    allowedProperties: ["stroke-dasharray", "stroke-dashoffset"],
  },
  sealFragmentOne: {
    targetKey: "chapter-ceremony:seal-fragment-1",
    part: "seal-fragment",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  sealFragmentTwo: {
    targetKey: "chapter-ceremony:seal-fragment-2",
    part: "seal-fragment",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  routePath: {
    targetKey: "chapter-ceremony:route-path",
    part: "route-path",
    ownerHint: "gsap",
    allowedProperties: ["stroke-dasharray", "stroke-dashoffset"],
  },
  mapFog: {
    targetKey: "chapter-ceremony:map-fog",
    part: "map-fog",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  quill: {
    targetKey: "chapter-ceremony:quill",
    part: "quill",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  quillPath: {
    targetKey: "chapter-ceremony:quill-path",
    part: "quill-path",
    ownerHint: "gsap",
    allowedProperties: ["path-drawing"],
  },
} as const;

function annotationEventKey(event: ClientProgressEvent | null | undefined) {
  return event?.type === "JOURNAL_ANNOTATION_ADDED" && typeof event.payload.key === "string" && event.payload.key.trim()
    ? event.payload.key
    : null;
}

function annotationChapterOrdinal(event: ClientProgressEvent) {
  const value = event.payload.chapterOrdinal;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function safeTargetToken(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "target"
  );
}

export function resolveJournalAnnotationTarget(
  event: ClientProgressEvent | null | undefined,
  pages: JournalPage[],
  authority: PageFlipPageTargetExportAuthority | null,
): JournalAnnotationTargetReady | null {
  if (!event || !authority) return null;
  const annotationKey = annotationEventKey(event);
  const chapterOrdinal = annotationChapterOrdinal(event);
  if (!annotationKey || chapterOrdinal === null) return null;
  const pageIndex = pageIndexForAnnotation(pages, annotationKey, chapterOrdinal);
  if (pageIndex < 0) return null;
  const pageId = pages[pageIndex]!.id;
  const markerSuffix = `:${safeTargetToken(`annotation:${annotationKey}:ink`)}`;
  const target = authority.targets.find(
    (candidate) =>
      candidate.current &&
      candidate.role === "primary" &&
      candidate.pageId === pageId &&
      candidate.part === "annotation-ink" &&
      candidate.targetKey.endsWith(markerSuffix),
  );
  if (!target) return null;
  return Object.freeze({
    eventId: event.id,
    annotationKey,
    chapterOrdinal,
    pageId,
    pageIndex,
    authority,
    target,
  });
}

export function JournalWorkspace({
  snapshot,
  mode,
  activeEvent,
  openingPhase,
  interactive,
  playbackRate,
  onPageTurn,
  onSceneHostChange,
  onSceneTargetsChange,
  onAnnotationTargetChange,
  onChapterInkCommandChange,
  onClaspStatusChange,
}: {
  snapshot: PublicSnapshot;
  mode: MotionMode;
  activeEvent: ClientProgressEvent | null;
  openingPhase: JournalOpeningPhase;
  interactive: boolean;
  playbackRate: 0.25 | 0.5 | 1;
  onPageTurn?: () => void;
  onSceneHostChange?: (host: SceneHostHandle | null) => void;
  onSceneTargetsChange?: (ready: JournalCeremonyTargetReady | null) => void;
  onAnnotationTargetChange?: (ready: JournalAnnotationTargetReady | null) => void;
  onChapterInkCommandChange?: (command: JournalChapterInkCommand | null) => void;
  /** Optional local Rive/fallback truth only; never progression acknowledgment or ordering authority. */
  onClaspStatusChange?: (status: RiveRuntimeStatus | null) => void;
}) {
  const book = useRef<PageFlipBookHandle>(null);
  const [ceremonyHost, setCeremonyHost] = useState<SceneHostHandle | null>(null);
  const [journalStageTarget, setJournalStageTarget] = useState<SceneTargetHandle | null>(null);
  const [ceremonyTargets, setCeremonyTargets] = useState<CeremonyOverlayTargetHandles | null>(null);
  const [pageTargets, setPageTargets] = useState<PageFlipPageTargetExportAuthority | null>(null);
  const pages = useMemo(() => buildJournalPages(snapshot).filter((page) => page.density === "soft"), [snapshot]);
  const flipPages = useMemo<FlipBookPage[]>(
    () =>
      pages.map((page) => ({
        id: page.id,
        density: page.density,
        label: page.title ?? page.eyebrow ?? page.kind,
        content: <JournalPageContent page={page} />,
      })),
    [pages],
  );
  const payload = activeEvent?.type === "CHAPTER_RELEASED" ? activeEvent.payload : null;
  const annotationTarget = useMemo(
    () => resolveJournalAnnotationTarget(activeEvent, pages, pageTargets),
    [activeEvent, pageTargets, pages],
  );
  const claspPose = journalClaspPoseByPhase[openingPhase];
  const claspStateValue = journalClaspOpeningPhase[claspPose];
  const claspLifecycleIdentity = [
    snapshot.campaign.slug,
    activeEvent?.id ?? `snapshot-${snapshot.sequence}`,
    openingPhase,
  ].join(":");
  const handleJournalStageTarget = useCallback((handle: SceneTargetHandle | null) => {
    setJournalStageTarget(handle);
  }, []);
  const handleCeremonyTargets = useCallback((handles: CeremonyOverlayTargetHandles | null) => {
    setCeremonyTargets(handles);
  }, []);
  const ready = useMemo<JournalCeremonyTargetReady | null>(() => {
    if (!ceremonyHost || !journalStageTarget || !ceremonyTargets) return null;
    return Object.freeze({
      host: ceremonyHost,
      targets: Object.freeze({
        "journal-stage": Object.freeze([journalStageTarget]),
        ...ceremonyTargets,
      }),
    });
  }, [ceremonyHost, ceremonyTargets, journalStageTarget]);

  useEffect(() => {
    onSceneHostChange?.(ready?.host ?? null);
    onSceneTargetsChange?.(ready);
    return () => {
      onSceneHostChange?.(null);
      onSceneTargetsChange?.(null);
    };
  }, [onSceneHostChange, onSceneTargetsChange, ready]);

  useEffect(() => {
    onAnnotationTargetChange?.(annotationTarget);
    return () => onAnnotationTargetChange?.(null);
  }, [annotationTarget, onAnnotationTargetChange]);

  return (
    <SceneHost
      as="section"
      kind="player-progression"
      hostKey={`journal-chapter-ceremony-${snapshot.campaign.slug}`}
      className="physical-section journal-workspace"
      aria-labelledby="journal-heading"
      data-section-heading
      data-journal-phase={openingPhase}
      tabIndex={-1}
    >
      <SceneHostHandleBridge onChange={setCeremonyHost} />
      <header className="section-masthead">
        <div>
          <p className="eyebrow">Chronicle record</p>
          <h2 id="journal-heading">The Voyage Journal</h2>
        </div>
        <p>Read the released Passages in this Voyage Journal.</p>
      </header>
      <PhysicalJournalBook
        ref={book}
        pages={flipPages}
        mode={mode}
        openingPhase={openingPhase}
        interactive={interactive}
        playbackRate={playbackRate}
        revision={snapshot.sequence}
        initialPage={pageIndexForChapter(pages, snapshot.chapter.ordinal)}
        coverTitle="Voyagewright"
        coverSubtitle="Captain's Voyage Journal"
        tabs={snapshot.chapters.map((chapter) => ({
          id: String(chapter.ordinal),
          ordinal: chapter.ordinal,
          label: chapter.title ?? chapter.teaser ?? "Sealed",
          state: chapter.state.toLowerCase(),
          pageIndex: pageIndexForChapter(pages, chapter.ordinal),
        }))}
        onSelectTab={(page) => book.current?.flipTo(page)}
        onPageTurn={onPageTurn}
        onPageTargetsChange={setPageTargets}
        onJournalStageTargetChange={handleJournalStageTarget}
        overlay={
          <>
            <JournalClaspAdapter
              key={claspLifecycleIdentity}
              mode={mode}
              pose={claspPose}
              stateValue={claspStateValue}
              nonce={snapshot.sequence}
              onStatusChange={onClaspStatusChange}
            />
            {payload && interactive ? (
              <ChapterCeremonyPage
                eventId={activeEvent!.id}
                payload={payload}
                mode={mode}
                onTargetsChange={handleCeremonyTargets}
                onInkCommandChange={onChapterInkCommandChange}
              />
            ) : null}
          </>
        }
      />
    </SceneHost>
  );
}

function JournalClaspAdapter({
  mode,
  pose,
  stateValue,
  nonce,
  onStatusChange,
}: Readonly<{
  mode: MotionMode;
  pose: JournalClaspPose;
  stateValue: number;
  nonce: number;
  onStatusChange?: (status: RiveRuntimeStatus | null) => void;
}>) {
  const [reportedStatus, setReportedStatus] = useState<RiveRuntimeStatus | null>(null);
  const statusRef = useRef<RiveRuntimeStatus | null>(null);
  const callbackRef = useRef(onStatusChange);

  useEffect(() => {
    const previous = callbackRef.current;
    if (previous === onStatusChange) return;
    previous?.(null);
    callbackRef.current = onStatusChange;
    if (statusRef.current) onStatusChange?.(statusRef.current);
  }, [onStatusChange]);

  useEffect(
    () => () => {
      callbackRef.current?.(null);
      callbackRef.current = undefined;
      statusRef.current = null;
    },
    [],
  );

  const handleStatus = useCallback((status: RiveRuntimeStatus) => {
    statusRef.current = status;
    setReportedStatus(status);
    callbackRef.current?.(status);
  }, []);

  return (
    <>
      <p className="sr-only" data-journal-clasp-readable-status data-journal-clasp-state={pose}>
        {journalClaspReadableState[pose]}
      </p>
      <div
        aria-hidden="true"
        data-journal-clasp-contract
        data-rive-contract-availability={riveAssets.journalClasp.availability}
        data-rive-runtime-status={reportedStatus ?? "pending"}
        data-rive-state={pose}
        data-rive-state-value={stateValue}
        data-rive-inputs={riveAssets.journalClasp.inputs.map((input) => input.name).join(",")}
        data-rive-reduced-pose={JSON.stringify(riveAssets.journalClasp.reducedPose)}
        data-rive-reduced-equivalent="semantic-final-state"
        data-rive-production-art-status={riveAssets.journalClasp.availability}
        style={{
          position: "absolute",
          zIndex: 31,
          top: "245px",
          left: "calc(50% + 130px)",
          width: "96px",
          height: "96px",
          pointerEvents: "none",
          opacity: pose === "open" ? 0.4 : 0.82,
        }}
      >
        <RiveStatefulObject
          asset={riveAssets.journalClasp}
          mode={mode}
          label={`Journal clasp, ${pose}`}
          signals={[
            { name: "openingPhase", value: stateValue, nonce: nonce * 2 },
            {
              name: "pressure",
              value: pose === "releasing" || pose === "opening" ? 1 : 0,
              nonce: nonce * 2 + 1,
            },
          ]}
          reducedMotion={{
            stablePose: riveAssets.journalClasp.reducedPose,
            allowedSemanticSignals: riveAssets.journalClasp.reducedSemanticSignals,
          }}
          onStatus={handleStatus}
        />
      </div>
    </>
  );
}

function SceneHostHandleBridge({ onChange }: { onChange: (host: SceneHostHandle | null) => void }) {
  const host = useOptionalSceneHost();
  useEffect(() => {
    onChange(host);
    return () => onChange(null);
  }, [host, onChange]);
  return null;
}

function JournalPageContent({ page }: { page: JournalPage }) {
  return (
    <div
      className={`journal-leaf page-kind-${page.kind}`}
      {...(page.annotationKey
        ? {
            "data-annotation-key": page.annotationKey,
            "data-annotation-unseen": String(Boolean(page.unseen)),
          }
        : {})}
    >
      <div className="paper-fibers" aria-hidden="true" />
      {page.folio && <span className="folio">— {page.folio} —</span>}
      {page.eyebrow && <p className="eyebrow">{page.eyebrow}</p>}
      {page.title && <h3>{page.title}</h3>}
      {page.body &&
        (page.annotationKey ? (
          <p
            className="journal-prose captain-annotation-ink"
            data-scene-part="annotation-ink"
            data-scene-target-key={`annotation:${page.annotationKey}:ink`}
            data-annotation-key={page.annotationKey}
            data-annotation-unseen={String(Boolean(page.unseen))}
            data-gsap-owned
          >
            {page.body}
          </p>
        ) : (
          <p className="journal-prose">{page.body}</p>
        ))}
      {page.objective && (
        <div className="page-objective">
          <span>Present course</span>
          <strong>{page.objective}</strong>
        </div>
      )}
      {page.riddle && (
        <blockquote>
          {page.riddle.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </blockquote>
      )}
      {page.note && <p className="captain-hand">{page.note}</p>}
      {page.state && (
        <span className={`chapter-state state-${page.state.toLowerCase()}`}>{page.state.replaceAll("_", " ")}</span>
      )}
      <div className="margin-sketch" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function useCeremonyTarget(input: Parameters<typeof useSceneTargetRegistration>[0]) {
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  return [bindTarget, handle] as const;
}

function ChapterCeremonyPage({
  eventId,
  payload,
  mode,
  onTargetsChange,
  onInkCommandChange,
}: {
  eventId: string;
  payload: Record<string, unknown>;
  mode: MotionMode;
  onTargetsChange: (handles: CeremonyOverlayTargetHandles | null) => void;
  onInkCommandChange?: (command: JournalChapterInkCommand | null) => void;
}) {
  const [bindSealedParchment, sealedParchmentHandle] = useCeremonyTarget(ceremonyTargetRegistrations.sealedParchment);
  const [bindInkHeadingEyebrow, inkHeadingEyebrowHandle] = useCeremonyTarget(
    ceremonyTargetRegistrations.inkHeadingEyebrow,
  );
  const [bindInkHeadingTitle, inkHeadingTitleHandle] = useCeremonyTarget(ceremonyTargetRegistrations.inkHeadingTitle);
  const [bindInkStory, inkStoryHandle] = useCeremonyTarget(ceremonyTargetRegistrations.inkStory);
  const [bindInkObjective, inkObjectiveHandle] = useCeremonyTarget(ceremonyTargetRegistrations.inkObjective);
  const [bindInkRiddle, inkRiddleHandle] = useCeremonyTarget(ceremonyTargetRegistrations.inkRiddle);
  const [bindPageLight, pageLightHandle] = useCeremonyTarget(ceremonyTargetRegistrations.pageLight);
  const [bindSeal, sealHandle] = useCeremonyTarget(ceremonyTargetRegistrations.seal);
  const [bindSealCrack, sealCrackHandle] = useCeremonyTarget(ceremonyTargetRegistrations.sealCrack);
  const [bindSealFragmentOne, sealFragmentOneHandle] = useCeremonyTarget(ceremonyTargetRegistrations.sealFragmentOne);
  const [bindSealFragmentTwo, sealFragmentTwoHandle] = useCeremonyTarget(ceremonyTargetRegistrations.sealFragmentTwo);
  const [bindRoutePath, routePathHandle] = useCeremonyTarget(ceremonyTargetRegistrations.routePath);
  const [bindMapFog, mapFogHandle] = useCeremonyTarget(ceremonyTargetRegistrations.mapFog);
  const [bindQuill, quillHandle] = useCeremonyTarget(ceremonyTargetRegistrations.quill);
  const [bindQuillPath, quillPathHandle] = useCeremonyTarget(ceremonyTargetRegistrations.quillPath);
  const bindInkBloom = useCallback(
    (handle: LottieEffectHandle | null) => {
      onInkCommandChange?.(
        handle
          ? Object.freeze({
              eventId,
              semanticLabel: "ink-story" as const,
              play: () => {
                const segment = lottieAssets.inkBloom.segments?.["ink-story"];
                if (segment && typeof handle.playSegment === "function") handle.playSegment([...segment]);
                else handle.play();
              },
              stop: () => handle.stop(),
            })
          : null,
      );
    },
    [eventId, onInkCommandChange],
  );
  const targets = useMemo<CeremonyOverlayTargetHandles | null>(() => {
    const required = [
      sealedParchmentHandle,
      inkHeadingEyebrowHandle,
      inkHeadingTitleHandle,
      inkStoryHandle,
      inkObjectiveHandle,
      inkRiddleHandle,
      pageLightHandle,
      sealHandle,
      sealCrackHandle,
      sealFragmentOneHandle,
      sealFragmentTwoHandle,
      routePathHandle,
      mapFogHandle,
      quillHandle,
      quillPathHandle,
    ];
    if (required.some((handle) => handle === null)) return null;
    return Object.freeze({
      "sealed-parchment": Object.freeze([sealedParchmentHandle!]),
      "ink-heading": Object.freeze([inkHeadingEyebrowHandle!, inkHeadingTitleHandle!]),
      "ink-story": Object.freeze([inkStoryHandle!]),
      "ink-objective": Object.freeze([inkObjectiveHandle!]),
      "ink-riddle": Object.freeze([inkRiddleHandle!]),
      "page-light": Object.freeze([pageLightHandle!]),
      seal: Object.freeze([sealHandle!]),
      "seal-crack": Object.freeze([sealCrackHandle!]),
      "seal-fragment": Object.freeze([sealFragmentOneHandle!, sealFragmentTwoHandle!]),
      "route-path": Object.freeze([routePathHandle!]),
      "map-fog": Object.freeze([mapFogHandle!]),
      quill: Object.freeze([quillHandle!]),
      "quill-path": Object.freeze([quillPathHandle!]),
    });
  }, [
    inkHeadingEyebrowHandle,
    inkHeadingTitleHandle,
    inkObjectiveHandle,
    inkRiddleHandle,
    inkStoryHandle,
    mapFogHandle,
    pageLightHandle,
    quillHandle,
    quillPathHandle,
    routePathHandle,
    sealCrackHandle,
    sealFragmentOneHandle,
    sealFragmentTwoHandle,
    sealHandle,
    sealedParchmentHandle,
  ]);

  useEffect(() => {
    onTargetsChange(targets);
    return () => onTargetsChange(null);
  }, [onTargetsChange, targets]);

  return (
    <div className="chapter-ceremony-page">
      <div ref={bindSealedParchment} className="sealed-parchment" data-scene-part="sealed-parchment" data-gsap-owned>
        <div
          ref={bindPageLight}
          className="page-light"
          data-scene-part="page-light"
          data-gsap-owned
          aria-hidden="true"
        />
        <div ref={bindSeal} className="ceremony-seal" data-scene-part="seal" data-gsap-owned aria-hidden="true">
          <span>F</span>
          <svg viewBox="0 0 180 180">
            <path
              ref={bindSealCrack}
              data-scene-part="seal-crack"
              data-gsap-owned
              d="M90 12l-8 53 23 18-34 16 15 68M24 88l57-23M105 83l50-20"
            />
            <path ref={bindSealFragmentOne} data-scene-part="seal-fragment" data-gsap-owned d="M24 88l57-23-10 34z" />
            <path ref={bindSealFragmentTwo} data-scene-part="seal-fragment" data-gsap-owned d="M105 83l50-20-34 42z" />
          </svg>
        </div>
        <p ref={bindInkHeadingEyebrow} className="eyebrow" data-scene-part="ink-heading" data-gsap-owned>
          Chapter {String(payload.ordinal ?? "")}
        </p>
        <h3 ref={bindInkHeadingTitle} data-scene-part="ink-heading" data-gsap-owned>
          {String(payload.title ?? "")}
        </h3>
        <p ref={bindInkStory} className="ceremony-story" data-scene-part="ink-story" data-gsap-owned data-ink-copy>
          {String(payload.narrative ?? "")}
        </p>
        <div ref={bindInkObjective} className="page-objective" data-scene-part="ink-objective" data-gsap-owned>
          <span>Present course</span>
          <strong>{String(payload.objective ?? "")}</strong>
        </div>
        <blockquote ref={bindInkRiddle} data-scene-part="ink-riddle" data-gsap-owned data-ink-copy>
          {String(payload.riddle ?? "")}
        </blockquote>
        <svg className="ceremony-route" viewBox="0 0 460 120" aria-hidden="true">
          <path
            ref={bindQuillPath}
            data-quill-path
            data-scene-part="quill-path"
            data-gsap-owned
            d="M18 86C130 12 270 24 438 82"
          />
          <path ref={bindRoutePath} data-scene-part="route-path" data-gsap-owned d="M18 86C130 12 270 24 438 82" />
        </svg>
        <div
          ref={bindMapFog}
          className="ceremony-map-fog"
          data-scene-part="map-fog"
          data-gsap-owned
          aria-hidden="true"
        />
        <div ref={bindQuill} className="ceremony-quill" data-scene-part="quill" data-gsap-owned aria-hidden="true" />
        <div className="ceremony-ink-bloom-decoration" aria-hidden="true">
          <LottieEffect
            ref={bindInkBloom}
            asset={lottieAssets.inkBloom}
            mode={mode}
            label="Ink blooming and drying across the released page"
            playback="commanded"
            className="ceremony-ink-bloom"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import { buildJournalPages, pageIndexForChapter, type JournalPage } from "@/animation/journal/page-model";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import type { FlipBookPage, PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { LottieEffect } from "@/components/animation/LottieEffect";
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
}) {
  const book = useRef<PageFlipBookHandle>(null);
  const [ceremonyHost, setCeremonyHost] = useState<SceneHostHandle | null>(null);
  const [journalStageTarget, setJournalStageTarget] = useState<SceneTargetHandle | null>(null);
  const [ceremonyTargets, setCeremonyTargets] = useState<CeremonyOverlayTargetHandles | null>(null);
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
          <p className="eyebrow">Primary story artifact</p>
          <h2 id="journal-heading">The Voyage Journal</h2>
        </div>
        <p>Selectable parchment, physical leaves, and only the words the tide has released.</p>
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
        coverTitle="The Forever Treasure"
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
        onJournalStageTargetChange={handleJournalStageTarget}
        overlay={
          payload && interactive ? (
            <ChapterCeremonyPage payload={payload} mode={mode} onTargetsChange={handleCeremonyTargets} />
          ) : null
        }
      />
    </SceneHost>
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
    <div className={`journal-leaf page-kind-${page.kind}`}>
      <div className="paper-fibers" aria-hidden="true" />
      {page.folio && <span className="folio">— {page.folio} —</span>}
      {page.eyebrow && <p className="eyebrow">{page.eyebrow}</p>}
      {page.title && <h3>{page.title}</h3>}
      {page.body && <p className="journal-prose">{page.body}</p>}
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
  payload,
  mode,
  onTargetsChange,
}: {
  payload: Record<string, unknown>;
  mode: MotionMode;
  onTargetsChange: (handles: CeremonyOverlayTargetHandles | null) => void;
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
    <div className="chapter-ceremony-page" role="status" aria-live="polite">
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
        <LottieEffect
          asset={lottieAssets.inkBloom}
          mode={mode}
          label="Ink blooming and drying across the released page"
          className="ceremony-ink-bloom"
        />
      </div>
    </div>
  );
}

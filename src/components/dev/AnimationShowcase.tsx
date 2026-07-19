"use client";

/* eslint-disable @next/next/no-img-element -- The lab previews original SVG assets without image optimization side effects. */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  sceneNames,
  type AnimatedProperty,
  type AnimationRuntimeOwner,
  type AnimationSceneName,
  type PresentationReceipt,
  type SceneHostKind,
} from "@/animation/core/animation-types";
import { resetAnimationMetrics } from "@/animation/core/metrics";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { sceneContracts } from "@/animation/director/scene-registry";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { ExternalSceneTargetHandle, SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { AnimationControls } from "@/components/animation/AnimationControls";
import { LottieEffect, type LottieEffectHandle } from "@/components/animation/LottieEffect";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import type { PageFlipBoundarySnapshot } from "@/components/animation/pageflip-boundary";
import { RiveStatefulObject, type RiveRuntimeInput, type RiveSignal } from "@/components/animation/RiveStatefulObject";
import { AnimationMetrics } from "./AnimationMetrics";

type Library = "all" | "gsap" | "motion" | "pageflip" | "rive" | "lottie";
export type ShowcaseDemo = {
  id: string;
  label: string;
  scene: AnimationSceneName;
  libraries: Library[];
  operation?: "success" | "failure";
  execution?: "runtime-only" | "non-executable";
};

export const showcaseDemos: ShowcaseDemo[] = [
  { id: "arrival", label: "First arrival", scene: "first-arrival", libraries: ["gsap", "lottie", "rive", "motion"] },
  { id: "reentry", label: "Same-session reentry", scene: "session-reentry", libraries: ["gsap", "motion"] },
  {
    id: "access-listening",
    label: "Player access listening",
    scene: "player-access",
    libraries: ["gsap", "rive", "lottie"],
  },
  {
    id: "access-success",
    label: "Player access success",
    scene: "player-access",
    libraries: ["gsap", "rive", "lottie", "motion"],
    operation: "success",
  },
  {
    id: "access-failure",
    label: "Player access failure",
    scene: "player-access",
    libraries: ["gsap", "rive", "motion"],
    operation: "failure",
  },
  {
    id: "gm-success",
    label: "Quartermaster login success",
    scene: "quartermaster-login",
    libraries: ["gsap", "rive", "lottie"],
    operation: "success",
  },
  {
    id: "gm-failure",
    label: "Quartermaster login failure",
    scene: "quartermaster-login",
    libraries: ["gsap", "rive"],
    operation: "failure",
  },
  {
    id: "journal-open",
    label: "Journal cover opening",
    scene: "journal-open",
    libraries: ["gsap", "pageflip", "rive"],
    execution: "non-executable",
  },
  {
    id: "manual-flip",
    label: "Manual page flip",
    scene: "manual-page-flip",
    libraries: ["pageflip"],
    execution: "runtime-only",
  },
  {
    id: "programmatic-flip",
    label: "Programmatic page flip",
    scene: "programmatic-page-flip",
    libraries: ["pageflip", "gsap"],
    execution: "runtime-only",
  },
  { id: "heading", label: "Live chapter-heading writing", scene: "chapter-heading", libraries: ["gsap"] },
  { id: "prose", label: "Long prose ink reveal", scene: "prose-ink", libraries: ["gsap", "lottie"] },
  { id: "seal", label: "Seal deformation and cracking", scene: "seal-break", libraries: ["gsap", "rive", "lottie"] },
  { id: "studio-publish", label: "Studio publish receipt", scene: "studio-publish", libraries: ["gsap", "motion"] },
  {
    id: "release",
    label: "Chapter-release full ceremony",
    scene: "chapter-release",
    libraries: ["gsap", "pageflip", "rive", "lottie", "motion"],
  },
  { id: "map", label: "Map fog reveal", scene: "map-reveal", libraries: ["gsap", "lottie"] },
  { id: "route", label: "Route drawing", scene: "route-draw", libraries: ["gsap"] },
  { id: "marker", label: "Marker stamp", scene: "marker-stamp", libraries: ["gsap", "rive"] },
  { id: "ship", label: "Ship token MotionPath", scene: "ship-course", libraries: ["gsap", "rive"] },
  { id: "silhouette", label: "Artifact silhouette reveal", scene: "artifact-award", libraries: ["gsap", "rive"] },
  { id: "artifact", label: "Artifact award", scene: "artifact-award", libraries: ["gsap", "rive", "lottie"] },
  {
    id: "inspection",
    label: "Artifact inspection",
    scene: "artifact-inspection",
    libraries: ["gsap", "motion", "rive"],
  },
  { id: "connection", label: "Artifact connection", scene: "artifact-connection", libraries: ["gsap"] },
  { id: "quest", label: "Quest discovery", scene: "quest-discovery", libraries: ["gsap", "pageflip", "lottie"] },
  { id: "quest-complete", label: "Quest completion stamp", scene: "quest-complete", libraries: ["gsap", "motion"] },
  { id: "log", label: "New Ship's Log entry", scene: "log-entry", libraries: ["gsap", "motion", "lottie"] },
  { id: "finale", label: "Finale tease", scene: "finale-tease", libraries: ["gsap", "rive", "lottie"] },
  {
    id: "finale-requirement",
    label: "Finale requirement activation",
    scene: "finale-requirement",
    libraries: ["gsap", "rive"],
  },
  { id: "prepare", label: "Prepare chapter command", scene: "prepare-chapter", libraries: ["gsap"] },
  { id: "mark-solved", label: "Mark chapter solved command", scene: "mark-solved", libraries: ["gsap"] },
  { id: "pause", label: "Pause", scene: "pause", libraries: ["gsap", "rive"] },
  { id: "resume", label: "Resume", scene: "resume", libraries: ["gsap", "rive"] },
  { id: "undo", label: "Undo reversal", scene: "undo", libraries: ["gsap"] },
  { id: "motion-nav", label: "Motion navigation transitions", scene: "session-reentry", libraries: ["motion"] },
  { id: "rive-inputs", label: "Rive state-machine inputs", scene: "session-reentry", libraries: ["rive"] },
  {
    id: "lottie-controls",
    label: "Lottie play, pause, segment, speed, and destroy",
    scene: "session-reentry",
    libraries: ["lottie"],
  },
  {
    id: "pageflip-modes",
    label: "StPageFlip portrait and landscape",
    scene: "programmatic-page-flip",
    libraries: ["pageflip"],
    execution: "runtime-only",
  },
  {
    id: "reduced",
    label: "Reduced-motion equivalents",
    scene: "chapter-release",
    libraries: ["gsap", "motion", "pageflip", "rive", "lottie"],
  },
  { id: "fallbacks", label: "Error and fallback states", scene: "session-reentry", libraries: ["rive", "lottie"] },
];

export const showcaseCoverage = {
  rows: showcaseDemos.length,
  uniqueScenes: new Set(showcaseDemos.map((demo) => demo.scene)).size,
  registeredScenes: sceneNames.length,
};

const showcaseDiagnosticHostId = "development-animation-showcase";
const showcaseDiagnosticHostKind = "development-showcase";

type ShowcaseTargetRequirement = Readonly<{
  targetKey: string;
  part: string;
  domPart: string;
  required: boolean;
  ownerHint?: AnimationRuntimeOwner;
  allowedProperties: readonly AnimatedProperty[];
  externalKey?: string;
}>;

type ShowcaseSceneRuntime = Readonly<{
  host: SceneHostHandle;
  root: HTMLElement;
  targets: ReadonlyMap<string, SceneTargetHandle>;
  requirements: readonly ShowcaseTargetRequirement[];
}>;

type ShowcaseHostRequest = Readonly<{
  nonce: number;
  scene: AnimationSceneName;
  kind: SceneHostKind;
}>;

const legacyAnimatedProperties = new Set<AnimatedProperty>([
  "transform",
  "opacity",
  "clip-path",
  "filter",
  "stroke-dasharray",
  "stroke-dashoffset",
  "layout",
  "visibility",
]);

const fixturePartAliases: Readonly<Record<string, string>> = Object.freeze({
  "map-marker": "map-marker-new",
});

function hostKindForScene(scene: AnimationSceneName): SceneHostKind {
  const contract = sceneContracts[scene];
  if (contract.version === 1) return contract.expectedHostKind as SceneHostKind;
  const preference: readonly SceneHostKind[] = [
    "player-progression",
    "gateway",
    "player-section-enhancement",
    "journal-opening",
    "quartermaster-command",
    "access",
  ];
  return preference.find((kind) => contract.expectedHostKinds.includes(kind)) ?? contract.expectedHostKinds[0];
}

function targetRequirementsForScene(scene: AnimationSceneName): readonly ShowcaseTargetRequirement[] {
  const contract = sceneContracts[scene];
  if (contract.version === 2) {
    return contract.targets.map((target) => ({
      targetKey: target.key,
      part: target.part,
      domPart: fixturePartAliases[target.part] ?? target.part,
      required: target.required,
      ...(target.owner ? { ownerHint: target.owner } : {}),
      allowedProperties: target.properties,
      ...(target.source.kind === "external" ? { externalKey: target.source.handleKey } : {}),
    }));
  }
  return [...contract.requiredTargets, ...contract.optionalTargets].map((target, index) => ({
    targetKey: `legacy:${target.part}:${index}`,
    part: target.part,
    domPart: fixturePartAliases[target.part] ?? target.part,
    required: target.required,
    ownerHint: target.owner,
    allowedProperties: target.properties.flatMap((property) =>
      legacyAnimatedProperties.has(property as AnimatedProperty) ? [property as AnimatedProperty] : [],
    ),
  }));
}

function exportShowcaseTargets(runtime: ShowcaseSceneRuntime) {
  const targets: Record<string, ExternalSceneTargetHandle> = {};
  const exported: ExternalSceneTargetHandle[] = [];
  for (const requirement of runtime.requirements) {
    if (!requirement.externalKey) continue;
    const target = runtime.targets.get(requirement.targetKey);
    if (!target) continue;
    const handle = runtime.host.exportTarget({
      target,
      destinationHostId: runtime.host.hostId,
      allowedProperties: requirement.allowedProperties,
      lifetime: "scene",
    });
    targets[requirement.externalKey] = handle;
    exported.push(handle);
  }
  return Object.freeze({ targets: Object.freeze(targets), exported: Object.freeze(exported) });
}

export function showcaseDemoLabel(demo: ShowcaseDemo) {
  return `${demo.label} — ${sceneContracts[demo.scene].reachability}`;
}

export function summarizeShowcaseReceipt(receipt: PresentationReceipt<unknown>) {
  const required = receipt.targetReport.observations.filter((observation) => observation.required);
  return {
    required: required.reduce((total, observation) => total + observation.matchedCount, 0),
    visible: required.reduce((total, observation) => total + observation.visibleCount, 0),
    duplicates: receipt.targetReport.observations.reduce((total, observation) => total + observation.duplicateCount, 0),
  };
}

const trailer: AnimationSceneName[] = [
  "first-arrival",
  "player-access",
  "chapter-release",
  "map-reveal",
  "route-draw",
  "artifact-award",
  "quest-discovery",
  "log-entry",
  "finale-tease",
  "session-reentry",
];

const bookPages: FlipBookPage[] = [
  {
    id: "demo-cover",
    density: "hard",
    label: "Demonstration journal cover",
    content: (
      <div className="demo-page cover">
        <span>THE FOREVER TREASURE</span>
        <strong>Animation Field Journal</strong>
      </div>
    ),
  },
  {
    id: "demo-title",
    density: "soft",
    label: "Demonstration title page",
    content: (
      <div className="demo-page">
        <span>Chapter I</span>
        <h3>A Safe Moonlit Bearing</h3>
        <p>Deterministic development copy proves that the page remains selectable and semantic.</p>
      </div>
    ),
  },
  {
    id: "demo-riddle",
    density: "soft",
    label: "Demonstration riddle page",
    content: (
      <div className="demo-page">
        <span>Present course</span>
        <blockquote>Where quiet ink meets borrowed light, a harmless test mark waits tonight.</blockquote>
      </div>
    ),
  },
  {
    id: "demo-back",
    density: "hard",
    label: "Demonstration back cover",
    content: (
      <div className="demo-page cover">
        <strong>Return by moonlight</strong>
      </div>
    ),
  },
];

export function AnimationShowcase() {
  const root = useRef<HTMLElement>(null);
  const lottie = useRef<LottieEffectHandle>(null);
  const book = useRef<PageFlipBookHandle>(null);
  const trailerCancelled = useRef(false);
  const hostNonce = useRef(0);
  const runtimeWaiter = useRef<{
    nonce: number;
    resolve: (runtime: ShowcaseSceneRuntime) => void;
    reject: (cause: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const { director, snapshot } = useAnimationDirector();
  const { mode, setMode } = useMotionMode();
  const [selected, setSelected] = useState("arrival");
  const [library, setLibrary] = useState<Library>("all");
  const [errors, setErrors] = useState<string[]>([]);
  const [assetStatus, setAssetStatus] = useState<Record<string, string>>({});
  const [riveInputs, setRiveInputs] = useState<RiveRuntimeInput[]>([]);
  const [riveSignal, setRiveSignal] = useState<RiveSignal>();
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [trailerCard, setTrailerCard] = useState("Animation architecture ready");
  const [runtimeEpoch, setRuntimeEpoch] = useState(0);
  const [hostRequest, setHostRequest] = useState<ShowcaseHostRequest>(() => ({
    nonce: 0,
    scene: "first-arrival",
    kind: hostKindForScene("first-arrival"),
  }));
  const [activeHostIdentity, setActiveHostIdentity] = useState<Readonly<{ id: string; kind: string }> | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<PresentationReceipt<unknown> | null>(null);
  const [pageFlipBoundary, setPageFlipBoundary] = useState<PageFlipBoundarySnapshot | null>(null);
  const current = showcaseDemos.find((demo) => demo.id === selected) ?? showcaseDemos[0];
  const visibleDemos = useMemo(
    () => (library === "all" ? showcaseDemos : showcaseDemos.filter((demo) => demo.libraries.includes(library))),
    [library],
  );
  const currentContract = sceneContracts[current.scene];
  const receiptCounts = latestReceipt ? summarizeShowcaseReceipt(latestReceipt) : null;

  const handleRuntimeChange = useCallback((nonce: number, runtime: ShowcaseSceneRuntime | null) => {
    if (!runtime) {
      setActiveHostIdentity(null);
      return;
    }
    setActiveHostIdentity({ id: runtime.host.hostId, kind: runtime.host.kind });
    const waiter = runtimeWaiter.current;
    if (!waiter || waiter.nonce !== nonce) return;
    clearTimeout(waiter.timeout);
    runtimeWaiter.current = null;
    waiter.resolve(runtime);
  }, []);

  const acquireRuntime = useCallback((scene: AnimationSceneName) => {
    const nonce = ++hostNonce.current;
    const previous = runtimeWaiter.current;
    if (previous) {
      clearTimeout(previous.timeout);
      previous.reject(new Error("Showcase host request was superseded."));
    }
    const promise = new Promise<ShowcaseSceneRuntime>((resolve, reject) => {
      runtimeWaiter.current = {
        nonce,
        resolve,
        reject,
        timeout: setTimeout(() => {
          if (runtimeWaiter.current?.nonce !== nonce) return;
          runtimeWaiter.current = null;
          reject(new Error(`Showcase host did not become ready for ${scene}.`));
        }, 2_000),
      };
    });
    setHostRequest({ nonce, scene, kind: hostKindForScene(scene) });
    return promise;
  }, []);

  useEffect(
    () => () => {
      const waiter = runtimeWaiter.current;
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Showcase unmounted before its scene host became ready."));
      runtimeWaiter.current = null;
    },
    [],
  );

  const executeScene = useCallback(
    async (demo: ShowcaseDemo, eventOrActionId: string) => {
      const runtime = await acquireRuntime(demo.scene);
      const external = exportShowcaseTargets(runtime);
      try {
        return await director.play(demo.scene, {
          root: runtime.root,
          sceneHost: runtime.host,
          hostId: runtime.host.hostId,
          hostKind: runtime.host.kind,
          externalTargets: external.targets,
          queue: false,
          requestSource: "development",
          eventOrActionId,
          finalStateRuntime: {
            commitFinalState: () => undefined,
            reconcileFinalState: () => undefined,
            renderStaticFallback: () => undefined,
            holdSafePose: () => undefined,
            verifyReadableState: () => runtime.root.isConnected,
            cleanup: () => undefined,
          },
          operation: demo.operation
            ? async () => {
                if (demo.operation === "failure") throw new Error("Deterministic showcase rejection");
                return { safe: true };
              }
            : undefined,
        });
      } finally {
        external.exported.forEach((handle) => handle.revoke());
      }
    },
    [acquireRuntime, director],
  );

  const play = useCallback(
    async (demo = current) => {
      if (!root.current) return;
      if (demo.execution === "non-executable") {
        setLatestReceipt(null);
        return;
      }
      if (demo.execution === "runtime-only") {
        setLatestReceipt(null);
        if (demo.id === "programmatic-flip") book.current?.flipTo(2);
        else book.current?.next();
        return;
      }
      try {
        const receipt = await executeScene(demo, `development-showcase:${demo.id}`);
        setLatestReceipt(receipt);
      } catch (cause) {
        if (demo.operation !== "failure")
          setErrors((items) => [...items, cause instanceof Error ? cause.message : "Unknown showcase error"]);
      }
    },
    [current, executeScene],
  );

  const playTrailer = useCallback(async () => {
    if (!root.current || trailerPlaying) return;
    trailerCancelled.current = false;
    setTrailerPlaying(true);
    const originalSpeed = snapshot.speed;
    director.setSpeed(mode === "full" ? 0.5 : mode === "gentle" ? 0.8 : 2);
    try {
      for (const scene of trailer) {
        if (trailerCancelled.current || !root.current) break;
        setTrailerCard(scene.replaceAll("-", " "));
        const demo = showcaseDemos.find(
          (candidate) => candidate.scene === scene && candidate.operation !== "failure",
        ) ?? {
          id: `trailer-${scene}`,
          label: scene,
          scene,
          libraries: ["gsap" as const],
        };
        const trailerDemo = scene === "player-access" ? { ...demo, operation: "success" as const } : demo;
        const receipt = await executeScene(trailerDemo, `development-trailer:${scene}`);
        setLatestReceipt(receipt);
      }
      setTrailerCard("GSAP · StPageFlip · Motion · Rive · Lottie");
    } catch (cause) {
      if (!trailerCancelled.current)
        setErrors((items) => [...items, cause instanceof Error ? cause.message : "Trailer failed"]);
    } finally {
      director.setSpeed(originalSpeed);
      setTrailerPlaying(false);
    }
  }, [director, executeScene, mode, snapshot.speed, trailerPlaying]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (snapshot.isPaused) director.resume();
        else if (snapshot.isPlaying) director.pause();
        else void play();
      }
      if (event.key.toLowerCase() === "r") {
        director.seek(0);
        if (!snapshot.isPlaying) void play();
      }
      if (event.key.toLowerCase() === "s") director.skip();
      if (event.key.toLowerCase() === "c") director.cancel("development-keyboard-interruption");
      if (event.key === "ArrowLeft") director.seek(Math.max(0, snapshot.progress - 0.05));
      if (event.key === "ArrowRight") director.seek(Math.min(1, snapshot.progress + 0.05));
      if (event.key === "Escape" && document.fullscreenElement) void document.exitFullscreen();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [director, play, snapshot.isPaused, snapshot.isPlaying, snapshot.progress]);

  function reset() {
    director.cancel("showcase-reset");
    director.setSpeed(1);
    trailerCancelled.current = true;
    setTrailerPlaying(false);
    setErrors([]);
    setLatestReceipt(null);
    setPageFlipBoundary(null);
    setAssetStatus({});
    setTrailerCard("Animation architecture ready");
    setRuntimeEpoch((value) => value + 1);
    resetAnimationMetrics();
    book.current?.turnTo(0);
    lottie.current?.stop();
  }

  return (
    <main
      ref={root}
      className={`animation-showcase stage-${snapshot.label}`}
      data-motion-mode={mode}
      data-scene-host-id={showcaseDiagnosticHostId}
      data-scene-host-kind={showcaseDiagnosticHostKind}
      data-active-scene-host-id={activeHostIdentity?.id ?? "pending"}
      data-active-scene-host-kind={activeHostIdentity?.kind ?? "pending"}
      data-harness-only="true"
    >
      <header className="showcase-header">
        <div>
          <p className="eyebrow">Development harness only · never production proof</p>
          <h1>Forever Treasure Animation Showcase</h1>
          <p>
            Every demonstration uses synthetic local content and never calls a progression API. A successful harness
            receipt does not prove production reachability, visibility, or integration.
          </p>
        </div>
        <div>
          <Link href="/">Return to harbor</Link>
          <button
            onClick={() =>
              document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
            }
          >
            Fullscreen
          </button>
          <button onClick={reset}>Reset</button>
        </div>
      </header>
      <section className="trailer-launch">
        <div>
          <span>Cinematic systems trailer</span>
          <h2>{trailerCard}</h2>
          <p>
            Full mode runs approximately 45–70 seconds at its authored trailer pace; gentle and reduced modes preserve
            the same story order.
          </p>
        </div>
        {trailerPlaying ? (
          <button
            className="trailer-button"
            onClick={() => {
              trailerCancelled.current = true;
              director.cancel("development-trailer-interruption");
            }}
          >
            STOP TRAILER
          </button>
        ) : (
          <button className="trailer-button" onClick={() => void playTrailer()}>
            PLAY TRAILER
          </button>
        )}
      </section>
      <div className="showcase-layout">
        <aside className="showcase-catalog">
          <p>
            {showcaseCoverage.rows} harness rows · {showcaseCoverage.uniqueScenes}/{showcaseCoverage.registeredScenes}{" "}
            registered scene contracts represented
          </p>
          <label>
            Library
            <select value={library} onChange={(event) => setLibrary(event.target.value as Library)}>
              {["all", "gsap", "motion", "pageflip", "rive", "lottie"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Scene
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {visibleDemos.map((demo) => (
                <option key={demo.id} value={demo.id}>
                  {showcaseDemoLabel(demo)}
                </option>
              ))}
            </select>
          </label>
          <button className="play-scene" onClick={() => void play()}>
            {current.execution === "non-executable" ? "Show replacement" : "Play selected scene"}
          </button>
          <AnimationControls mode={mode} setMode={setMode} />
          <div className="keyboard-help">
            <h2>Keyboard</h2>
            <p>
              <kbd>Space</kbd> play / pause
            </p>
            <p>
              <kbd>R</kbd> restart
            </p>
            <p>
              <kbd>S</kbd> skip
            </p>
            <p>
              <kbd>C</kbd> interrupt
            </p>
            <p>
              <kbd>←</kbd>
              <kbd>→</kbd> seek
            </p>
            <p>
              <kbd>Esc</kbd> exit fullscreen
            </p>
          </div>
        </aside>
        <section key={runtimeEpoch} className="showcase-stage" aria-label="Animation demonstration stage">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected}
              className="showcase-title-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span>Harness only · {currentContract.reachability}</span>
              <span>{current.libraries.join(" · ")}</span>
              <strong>{current.label}</strong>
              <p>
                Synthetic development host; not production proof.
                {currentContract.replacedBy ? ` Replaced by ${currentContract.replacedBy}.` : ""}
                {current.execution === "runtime-only"
                  ? " This row invokes the real StPageFlip runtime and never plays the deprecated scene contract."
                  : ""}
                {current.execution === "non-executable"
                  ? " This deprecated row is non-executable; the bounded Journal opening state machine is authoritative."
                  : ""}
              </p>
            </motion.div>
          </AnimatePresence>
          <ShowcaseSceneHost
            key={`${runtimeEpoch}:${hostRequest.nonce}`}
            request={hostRequest}
            mode={mode}
            onRuntimeChange={handleRuntimeChange}
          />
          <div className="library-lab">
            <section>
              <h2>StPageFlip</h2>
              <PageFlipBook
                ref={book}
                pages={bookPages}
                mode={mode}
                bookId="animation-showcase-pageflip"
                className="showcase-book"
                onBoundaryChange={setPageFlipBoundary}
              />
              <dl aria-label="StPageFlip runtime boundary">
                <div>
                  <dt>Lifecycle</dt>
                  <dd>{pageFlipBoundary?.lifecycle ?? (mode === "reduced" ? "static-reader" : "initializing")}</dd>
                </div>
                <div>
                  <dt>Runtime generation</dt>
                  <dd>{pageFlipBoundary?.runtimeGeneration ?? 0}</dd>
                </div>
                <div>
                  <dt>Clone generation</dt>
                  <dd>{pageFlipBoundary?.cloneGeneration ?? 0}</dd>
                </div>
                <div>
                  <dt>Current logical page</dt>
                  <dd>
                    {pageFlipBoundary
                      ? `${pageFlipBoundary.currentPage + 1} (${pageFlipBoundary.orientation})`
                      : "none"}
                  </dd>
                </div>
              </dl>
              <div className="inline-controls">
                <button onClick={() => book.current?.previous()}>Previous</button>
                <button onClick={() => book.current?.next()}>Next</button>
                <button onClick={() => book.current?.flipTo(2)}>Flip to riddle</button>
              </div>
            </section>
            <section>
              <h2>Rive state machine</h2>
              <RiveStatefulObject
                asset={riveAssets.developmentRating}
                mode={mode}
                label="MIT-licensed Rive rating state-machine demonstration"
                signal={riveSignal}
                onInputs={setRiveInputs}
                onStatus={(status) => setAssetStatus((items) => ({ ...items, rive: status }))}
              />
              <div className="rive-inputs">
                {riveInputs.length ? (
                  riveInputs.map((input) => (
                    <button
                      key={input.name}
                      onClick={() =>
                        setRiveSignal({
                          name: input.name,
                          value:
                            input.type === "boolean"
                              ? !input.value
                              : input.type === "number"
                                ? Number(input.value ?? 0) + 1
                                : undefined,
                          nonce: Date.now(),
                        })
                      }
                    >
                      {input.name} · {input.type}
                    </button>
                  ))
                ) : (
                  <p>Inputs appear after the local binary loads.</p>
                )}
              </div>
            </section>
            <section>
              <h2>Lottie controls</h2>
              <LottieEffect
                ref={lottie}
                asset={lottieAssets.inkBloom}
                mode={mode}
                label="Original ink bloom Lottie control demonstration"
                onStatus={(status) => setAssetStatus((items) => ({ ...items, lottie: status }))}
              />
              <div className="inline-controls">
                <button onClick={() => lottie.current?.play()}>Play</button>
                <button onClick={() => lottie.current?.pause()}>Pause</button>
                <button onClick={() => lottie.current?.playSegment([8, 46])}>Segment</button>
                <button onClick={() => lottie.current?.setSpeed(2)}>2x</button>
                <button onClick={() => lottie.current?.setDirection(-1)}>Reverse</button>
                <button onClick={() => lottie.current?.destroy()}>Destroy</button>
              </div>
            </section>
          </div>
        </section>
        <div className="showcase-observability">
          <AnimationMetrics snapshot={snapshot} />
          <section className="asset-status">
            <h2>Asset status</h2>
            <dl>
              <div>
                <dt>Rive</dt>
                <dd>{assetStatus.rive ?? "not mounted"}</dd>
              </div>
              <div>
                <dt>Lottie</dt>
                <dd>{assetStatus.lottie ?? "not mounted"}</dd>
              </div>
              <div>
                <dt>Production Rive art</dt>
                <dd>documented fallbacks</dd>
              </div>
            </dl>
          </section>
          <section className="receipt-readout" aria-label="Latest development presentation receipt">
            <h2>Latest typed receipt · sanitized</h2>
            {latestReceipt && receiptCounts ? (
              <>
                <dl>
                  <div>
                    <dt>Scene</dt>
                    <dd>{latestReceipt.sceneName}</dd>
                  </div>
                  <div>
                    <dt>Scene instance</dt>
                    <dd>{latestReceipt.sceneInstanceId}</dd>
                  </div>
                  <div>
                    <dt>Outcome</dt>
                    <dd>{latestReceipt.outcome}</dd>
                  </div>
                  <div>
                    <dt>Host</dt>
                    <dd>
                      {latestReceipt.hostKind} · {latestReceipt.hostId}
                    </dd>
                  </div>
                  <div>
                    <dt>Request source</dt>
                    <dd>{latestReceipt.requestSource}</dd>
                  </div>
                  <div>
                    <dt>Required matched</dt>
                    <dd>{receiptCounts.required}</dd>
                  </div>
                  <div>
                    <dt>Required visible</dt>
                    <dd>{receiptCounts.visible}</dd>
                  </div>
                  <div>
                    <dt>Duplicates</dt>
                    <dd>{receiptCounts.duplicates}</dd>
                  </div>
                  <div>
                    <dt>Target failures</dt>
                    <dd>
                      {latestReceipt.targetReport.failures.length
                        ? latestReceipt.targetReport.failures
                            .map((failure) => `${failure.part}:${failure.code}`)
                            .join(", ")
                        : "none"}
                    </dd>
                  </div>
                  <div>
                    <dt>Fallback</dt>
                    <dd>{latestReceipt.fallbackUsed ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Acknowledgment decision</dt>
                    <dd>{latestReceipt.acknowledgmentAllowed ? "allowed by contract" : "not allowed"}</dd>
                  </div>
                  <div>
                    <dt>Cleanup</dt>
                    <dd>{latestReceipt.cleanup}</dd>
                  </div>
                </dl>
                <p>Display payloads and operation results are intentionally excluded.</p>
              </>
            ) : (
              <p>No presentation receipt yet.</p>
            )}
          </section>
          <section className="error-log" aria-live="polite">
            <h2>Error log</h2>
            {errors.length ? (
              <ol>
                {errors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ol>
            ) : (
              <p>No runtime errors.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ShowcaseSceneHost({
  request,
  mode,
  onRuntimeChange,
}: {
  request: ShowcaseHostRequest;
  mode: ReturnType<typeof useMotionMode>["mode"];
  onRuntimeChange: (nonce: number, runtime: ShowcaseSceneRuntime | null) => void;
}) {
  const handleRuntimeChange = useCallback(
    (runtime: ShowcaseSceneRuntime | null) => onRuntimeChange(request.nonce, runtime),
    [onRuntimeChange, request.nonce],
  );
  return (
    <SceneHost
      kind={request.kind}
      hostKey={`development-showcase:${request.scene}:${request.nonce}`}
      className="showcase-scene-host"
      data-showcase-scene={request.scene}
      data-showcase-host-instance={request.nonce}
    >
      <DemoStage scene={request.scene} mode={mode} onRuntimeChange={handleRuntimeChange} />
    </SceneHost>
  );
}

const authoredFixtureParts = new Set([
  "sky",
  "stars",
  "moon",
  "horizon",
  "ocean",
  "fog-back",
  "fog-front",
  "ship",
  "title",
  "emblem",
  "arrival-copy",
  "arrival-action",
  "nautical-border",
  "invitation",
  "ribbon",
  "seal",
  "seal-crack",
  "seal-fragment",
  "invitation-ink",
  "journal-stage",
  "sealed-parchment",
  "ink-heading",
  "ink-story",
  "ink-objective",
  "ink-riddle",
  "page-light",
  "quill",
  "quill-path",
  "route-motion-path",
  "route-path",
  "artifact-connection-path",
  "red-thread",
  "finale-light-path",
  "map-fog",
  "map-marker-new",
  "ship-token",
  "artifact-reveal",
  "artifact-slot-target",
  "artifact-light",
  "artifact-engraving",
  "quest-note-new",
  "quest-stamp",
  "log-entry-new",
  "log-symbol-new",
  "finale-ring-outer",
  "finale-ring-inner",
  "workspace-light",
  "lantern",
  "blank-page",
  "solved-stamp",
  "undo-mark",
]);

function DemoStage({
  scene,
  mode,
  onRuntimeChange,
}: {
  scene: AnimationSceneName;
  mode: ReturnType<typeof useMotionMode>["mode"];
  onRuntimeChange: (runtime: ShowcaseSceneRuntime | null) => void;
}) {
  const host = useOptionalSceneHost();
  const root = useRef<HTMLDivElement>(null);
  const requirements = useMemo(() => targetRequirementsForScene(scene), [scene]);
  const supplementalParts = useMemo(
    () =>
      [...new Set(requirements.map((requirement) => requirement.domPart))].filter(
        (part) => !authoredFixtureParts.has(part),
      ),
    [requirements],
  );

  useLayoutEffect(() => {
    const stage = root.current;
    if (!host || !stage) return;
    const handles = new Map<string, SceneTargetHandle>();
    try {
      for (const requirement of requirements) {
        const element = stage.querySelector(`[data-scene-part="${requirement.domPart}"]`);
        if (!element) {
          if (requirement.required) throw new Error(`Required showcase fixture is missing: ${requirement.domPart}`);
          continue;
        }
        const handle = host.registerTarget({
          targetKey: requirement.targetKey,
          part: requirement.part,
          element,
          ...(requirement.ownerHint ? { ownerHint: requirement.ownerHint } : {}),
          allowedProperties: requirement.allowedProperties,
        });
        handles.set(requirement.targetKey, handle);
      }
      const missingRequired = requirements.filter(
        (requirement) => requirement.required && !handles.has(requirement.targetKey),
      );
      if (missingRequired.length) {
        throw new Error(
          `Required showcase targets did not register: ${missingRequired.map((item) => item.targetKey).join(", ")}`,
        );
      }
      onRuntimeChange(Object.freeze({ host, root: stage, targets: handles, requirements }));
    } catch (cause) {
      [...handles.values()].reverse().forEach((handle) => handle.release());
      throw cause;
    }
    return () => {
      onRuntimeChange(null);
      [...handles.values()].reverse().forEach((handle) => handle.release());
    };
  }, [host, onRuntimeChange, requirements]);

  return (
    <div ref={root} className="demo-physical-stage">
      <div className="demo-sky" data-scene-part="sky" data-gsap-owned>
        <i data-scene-part="stars" />
      </div>
      <div className="demo-moon" data-scene-part="moon" data-gsap-owned />
      <div className="demo-horizon" data-scene-part="horizon" data-gsap-owned />
      <div className="demo-ocean" data-scene-part="ocean" data-gsap-owned />
      <div className="demo-fog back" data-scene-part="fog-back" data-gsap-owned />
      <div className="demo-fog front" data-scene-part="fog-front" data-gsap-owned />
      <div className="demo-ship" data-scene-part="ship" data-gsap-owned>
        ▲
      </div>
      <div className="demo-title" data-scene-part="title" data-gsap-owned>
        The Forever Treasure
      </div>
      <div className="demo-emblem" data-scene-part="emblem" data-gsap-owned>
        ✦
      </div>
      <p data-scene-part="arrival-copy" data-gsap-owned>
        A safe miniature voyage for development review.
      </p>
      <div data-scene-part="arrival-action" data-gsap-owned />
      <div data-scene-part="nautical-border" data-gsap-owned />
      <div className="demo-invitation" data-scene-part="invitation" data-gsap-owned>
        <div className="demo-ribbon" data-scene-part="ribbon" data-gsap-owned />
        <div className="demo-seal" data-scene-part="seal" data-gsap-owned>
          F
          <svg viewBox="0 0 160 160">
            <path data-scene-part="seal-crack" d="M80 10L70 65 94 78 64 95 80 150" />
            <path data-scene-part="seal-fragment" d="M30 80l40-15-6 30z" />
          </svg>
        </div>
        <span data-scene-part="invitation-ink" data-gsap-owned>
          Speak the harmless development phrase
        </span>
      </div>
      <div className="demo-journal" data-scene-part="journal-stage" data-gsap-owned>
        <div data-scene-part="journal-cover" data-gsap-owned />
        <div data-scene-part="journal-clasp" data-gsap-owned />
        <div className="demo-parchment" data-scene-part="sealed-parchment" data-gsap-owned>
          <h3 data-scene-part="ink-heading" data-gsap-owned>
            Chapter I · The Lantern Test
          </h3>
          <p data-scene-part="ink-story" data-gsap-owned>
            Moonlit lines arrive in masks, preserving one coherent semantic copy for every reader.
          </p>
          <strong data-scene-part="ink-objective" data-gsap-owned>
            Confirm the harmless development mark.
          </strong>
          <blockquote data-scene-part="ink-riddle" data-gsap-owned>
            Where painted waves meet borrowed light.
          </blockquote>
          <div data-scene-part="page-light" data-gsap-owned />
          <div data-scene-part="quill" data-gsap-owned>
            ✒
          </div>
        </div>
      </div>
      <svg className="demo-route" viewBox="0 0 520 250" aria-hidden="true">
        <path data-scene-part="quill-path" data-quill-path d="M30 170C150 30 330 30 490 170" />
        <path data-scene-part="route-motion-path" data-route-motion-path d="M30 170C150 30 330 30 490 170" />
        <path data-scene-part="route-path" data-gsap-owned d="M30 170C150 30 330 30 490 170" />
        <path data-scene-part="artifact-connection-path" data-gsap-owned d="M60 90Q260 230 460 90" />
        <path data-scene-part="red-thread" data-gsap-owned d="M40 210C170 60 330 60 480 200" />
        <path data-scene-part="finale-light-path" data-gsap-owned d="M260 20L450 125 260 230 70 125z" />
      </svg>
      <div className="demo-map-fog" data-scene-part="map-fog" data-gsap-owned />
      <div className="demo-marker" data-scene-part="map-marker-new" data-gsap-owned>
        ✦
      </div>
      <div className="demo-ship-token" data-scene-part="ship-token" data-gsap-owned>
        ▲
      </div>
      <div className="demo-artifact" data-scene-part="artifact-reveal" data-gsap-owned>
        <img src="/illustrations/artifacts/compass-needle.svg" alt="" />
      </div>
      <div className="demo-artifact-slot" data-scene-part="artifact-slot-target" />
      <div data-scene-part="artifact-light" data-gsap-owned />
      <div className="demo-engraving" data-scene-part="artifact-engraving" data-gsap-owned>
        Recovered beneath a harmless moon.
      </div>
      <div className="demo-quest" data-scene-part="quest-note-new" data-gsap-owned>
        Optional course
        <div data-scene-part="quest-stamp" data-gsap-owned>
          COMPLETE
        </div>
      </div>
      <div className="demo-log" data-scene-part="log-entry-new" data-gsap-owned>
        <i data-scene-part="log-symbol-new" data-gsap-owned>
          ✦
        </i>
        A safe event enters the log.
      </div>
      <div className="demo-finale">
        <i data-scene-part="finale-ring-outer" data-gsap-owned />
        <i data-scene-part="finale-ring-inner" data-gsap-owned />
      </div>
      <div data-scene-part="workspace-light" data-gsap-owned />
      <div data-scene-part="peripheral" data-gsap-owned />
      <div data-scene-part="lantern" data-gsap-owned />
      <div data-scene-part="living-idle" data-gsap-owned />
      <div className="demo-command">
        <div data-scene-part="blank-page" data-gsap-owned />
        <div data-scene-part="solved-stamp" data-gsap-owned>
          SOLVED
        </div>
        <div data-scene-part="undo-mark" data-gsap-owned>
          ↶
        </div>
      </div>
      {supplementalParts.map((part) => (
        <span
          key={part}
          data-scene-part={part}
          data-gsap-owned
          aria-hidden="true"
          style={{ display: "block", width: 1, height: 1, overflow: "hidden" }}
        >
          {part}
        </span>
      ))}
      <LottieEffect
        asset={lottieAssets.moonlitWaves}
        mode={mode}
        label="Showcase moonlit waves"
        className="demo-lottie-waves"
      />
    </div>
  );
}

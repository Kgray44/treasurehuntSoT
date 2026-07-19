"use client";

/* eslint-disable @next/next/no-img-element -- The lab previews original SVG assets without image optimization side effects. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sceneNames, type AnimationSceneName, type PresentationReceipt } from "@/animation/core/animation-types";
import { resetAnimationMetrics } from "@/animation/core/metrics";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { sceneContracts } from "@/animation/director/scene-registry";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { AnimationControls } from "@/components/animation/AnimationControls";
import { LottieEffect, type LottieEffectHandle } from "@/components/animation/LottieEffect";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { RiveStatefulObject, type RiveRuntimeInput, type RiveSignal } from "@/components/animation/RiveStatefulObject";
import { AnimationMetrics } from "./AnimationMetrics";

type Library = "all" | "gsap" | "motion" | "pageflip" | "rive" | "lottie";
export type ShowcaseDemo = {
  id: string;
  label: string;
  scene: AnimationSceneName;
  libraries: Library[];
  operation?: "success" | "failure";
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
  },
  { id: "manual-flip", label: "Manual page flip", scene: "manual-page-flip", libraries: ["pageflip"] },
  {
    id: "programmatic-flip",
    label: "Programmatic page flip",
    scene: "programmatic-page-flip",
    libraries: ["pageflip", "gsap"],
  },
  { id: "heading", label: "Live chapter-heading writing", scene: "chapter-heading", libraries: ["gsap"] },
  { id: "prose", label: "Long prose ink reveal", scene: "prose-ink", libraries: ["gsap", "lottie"] },
  { id: "seal", label: "Seal deformation and cracking", scene: "seal-break", libraries: ["gsap", "rive", "lottie"] },
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

const showcaseHostId = "development-animation-showcase";
const showcaseHostKind = "development-showcase";

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
  "journal-open",
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
  const [latestReceipt, setLatestReceipt] = useState<PresentationReceipt<unknown> | null>(null);
  const current = showcaseDemos.find((demo) => demo.id === selected) ?? showcaseDemos[0];
  const visibleDemos = useMemo(
    () => (library === "all" ? showcaseDemos : showcaseDemos.filter((demo) => demo.libraries.includes(library))),
    [library],
  );
  const currentContract = sceneContracts[current.scene];
  const receiptCounts = latestReceipt ? summarizeShowcaseReceipt(latestReceipt) : null;

  const play = useCallback(
    async (demo = current) => {
      if (!root.current) return;
      try {
        const receipt = await director.play(demo.scene, {
          root: root.current,
          queue: false,
          hostId: showcaseHostId,
          hostKind: showcaseHostKind,
          requestSource: "development",
          eventOrActionId: `development-showcase:${demo.id}`,
          operation: demo.operation
            ? async () => {
                if (demo.operation === "failure") throw new Error("Deterministic showcase rejection");
                return { safe: true };
              }
            : undefined,
        });
        setLatestReceipt(receipt);
        if (demo.scene === "programmatic-page-flip") book.current?.flipTo(2);
      } catch (cause) {
        if (demo.operation !== "failure")
          setErrors((items) => [...items, cause instanceof Error ? cause.message : "Unknown showcase error"]);
      }
    },
    [current, director],
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
        const operation = scene === "player-access" ? async () => ({ safe: true }) : undefined;
        const receipt = await director.play(scene, {
          root: root.current,
          operation,
          queue: false,
          hostId: showcaseHostId,
          hostKind: showcaseHostKind,
          requestSource: "development",
          eventOrActionId: `development-trailer:${scene}`,
        });
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
  }, [director, mode, snapshot.speed, trailerPlaying]);

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
      data-scene-host-id={showcaseHostId}
      data-scene-host-kind={showcaseHostKind}
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
            Play selected scene
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
              </p>
            </motion.div>
          </AnimatePresence>
          <DemoStage mode={mode} />
          <div className="library-lab">
            <section>
              <h2>StPageFlip</h2>
              <PageFlipBook ref={book} pages={bookPages} mode={mode} className="showcase-book" />
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

function DemoStage({ mode }: { mode: ReturnType<typeof useMotionMode>["mode"] }) {
  return (
    <div className="demo-physical-stage">
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
        <path data-quill-path d="M30 170C150 30 330 30 490 170" />
        <path data-route-motion-path d="M30 170C150 30 330 30 490 170" />
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
      <LottieEffect
        asset={lottieAssets.moonlitWaves}
        mode={mode}
        label="Showcase moonlit waves"
        className="demo-lottie-waves"
      />
    </div>
  );
}

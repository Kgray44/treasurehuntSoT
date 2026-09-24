"use client";
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MusterProjection } from "@/muster/contracts";
import { Compass } from "@/components/muster/icons";
import { useMotionMode } from "../motion/useMotionMode";
import { AnimationAuthorityContext } from "../hosts/SceneHostContext";
import { createSceneFinalStateHandoff } from "../core/final-state-handoff";
import type { SceneInstanceId } from "../core/animation-types";
import { preferenceRuntimeEvent } from "@/homeport/preference-runtime";
import { EmbarkationRenderer, type EmbarkationArtDirection } from "./renderer";
import { EmbarkationAudio } from "./audio";
import { MusterLanding, sourceFrame } from "./dom";
import { GenericStage } from "./GenericStage";
import { takeOutgoing } from "./navigation";
import { environmentPlanes } from "./environment";
import {
  camera,
  DURATION,
  CUT,
  clamp,
  entryDuration,
  EMBARKATION_VERSION,
  poseAt,
  seedFor,
  smooth,
  welcome,
  type Tier,
} from "./program";
import "./embarkation.css";

const Inspector = process.env.NODE_ENV !== "production" ? lazy(() => import("./Inspector")) : null;
export type EmbarkationSnapshot = {
  time: number;
  filmTime: number;
  duration: number;
  tier: Tier;
  seed: number;
  fps: number;
  p95: number;
  renderMs: number;
  reduced: boolean;
  mute: boolean;
  active: string[];
};
export type EmbarkationControls = {
  snapshot: () => EmbarkationSnapshot;
  play: () => void;
  pause: () => void;
  restart: () => void;
  seek: (time: number) => void;
  speed: (speed: number) => void;
  quality: (tier: Tier) => void;
  reduced: (value: boolean) => void;
  mute: (value: boolean) => void;
  layer: (layer: string) => void;
  debug: (value: boolean) => void;
  freezeLiving: (value: boolean) => void;
  projection: (value: boolean) => void;
  fail: () => void;
};
declare global {
  interface Window {
    __embarkation?: EmbarkationControls & { diagnostics: () => unknown };
    __embarkationLast?: unknown;
    __musterLiving?: {
      time: number;
      camera: number[];
      tier: Tier;
      reduced: boolean;
      rendering: boolean;
      pause: () => void;
      play: () => void;
      seek: (time: number) => void;
      freeze: (value: boolean) => void;
      diagnostics: () => unknown;
    };
  }
}
function experience() {
  const d = document.documentElement.dataset;
  let measured: Tier = "CINEMATIC";
  try {
    const stored = localStorage.getItem("voyagewright.embarkation-auto.v1");
    if (stored === "BALANCED" || stored === "PERFORMANCE") measured = stored;
  } catch {
    /* Storage is optional; the reference tier remains available. */
  }
  return {
    tier: ["CINEMATIC", "BALANCED", "PERFORMANCE"].includes(d.experienceQuality ?? "")
      ? (d.experienceQuality as Tier)
      : measured,
    audio: d.experienceAudio === "true",
    volume: clamp(Number(d.experienceVolume ?? 50) / 100),
  };
}
const percentile = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) * q)] ?? 0;
};
const localReceipts = new Set<string>();
export function Embarkation({
  room,
  destinationReady,
  children,
  onActiveChange,
  artDirection,
}: {
  room: MusterProjection;
  destinationReady: boolean;
  children: ReactNode;
  onActiveChange?: (active: boolean) => void;
  artDirection?: EmbarkationArtDirection;
}) {
  const authority = useContext(AnimationAuthorityContext),
    motion = useMotionMode();
  const hostRef = useRef<HTMLDivElement>(null),
    overlayRef = useRef<HTMLDivElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    backgroundRef = useRef<HTMLCanvasElement>(null),
    focusRef = useRef<HTMLDivElement>(null),
    welcomeRef = useRef<HTMLDivElement>(null),
    quietRef = useRef<HTMLDivElement>(null),
    debugRef = useRef<HTMLCanvasElement>(null),
    holdRef = useRef<HTMLButtonElement>(null);
  const roomRef = useRef(room);
  const artDirectionRef = useRef(artDirection);
  useLayoutEffect(() => {
    roomRef.current = room;
    artDirectionRef.current = artDirection;
  }, [room, artDirection]);
  const [active, setActive] = useState(true),
    [ready, setReady] = useState(false),
    [revision, setRevision] = useState(0),
    [controls, setControls] = useState<EmbarkationControls | null>(null),
    [tierOverride, setTierOverride] = useState<Tier | null>(null),
    [forceReduced, setForceReduced] = useState(false);
  const replayRef = useRef(false),
    startRef = useRef<() => void>(() => {}),
    holdStart = useRef<number | null>(null),
    finishRef = useRef<(reason: "completed" | "skipped" | "fallback") => void>(() => {});
  const dev = useRef<{
    inspect: boolean;
    scenario: string;
    quality: Tier | null;
    reduce: boolean;
    optional: boolean;
    rendererFail: boolean;
  } | null>(null);
  const [inspect, setInspect] = useState(false);
  const signalRef = useRef<AbortController | null>(null);
  const ambienceRef = useRef<EmbarkationAudio | null>(null);
  const livingRef = useRef<{ renderer: EmbarkationRenderer; time: number } | null>(null);
  const motionRef = useRef(motion);
  useLayoutEffect(() => {
    motionRef.current = motion;
  }, [motion]);
  useEffect(() => {
    if (active) {
      ambienceRef.current?.dispose();
      ambienceRef.current = null;
      return;
    }
    const update = () => {
      const prefs = experience();
      ambienceRef.current?.update(DURATION, prefs.audio, prefs.volume, document.hidden, true);
    };
    update();
    const interval = setInterval(update, 1000);
    window.addEventListener(preferenceRuntimeEvent, update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener(preferenceRuntimeEvent, update);
      document.removeEventListener("visibilitychange", update);
      ambienceRef.current?.dispose();
      ambienceRef.current = null;
    };
  }, [active]);
  useEffect(() => {
    if (active) return;
    const host = hostRef.current,
      background = backgroundRef.current;
    if (!host || !background) return;
    const abort = new AbortController();
    let raf = 0,
      previous = 0,
      lastDraw = 0,
      paused = false,
      freeze = false,
      clock = livingRef.current?.time ?? DURATION;
    let owned = livingRef.current?.renderer ?? null;
    const frame = (now: number) => {
      if (abort.signal.aborted) return;
      if (previous && !document.hidden && !paused) clock += (now - previous) / 1000;
      previous = now;
      const preference = experience(),
        interval = preference.tier === "CINEMATIC" ? 1000 / 60 : preference.tier === "BALANCED" ? 1000 / 30 : 1000 / 20;
      if (owned?.gl.isContextLost()) {
        owned.dispose();
        owned = null;
        delete host.dataset.livingEnvironment;
        background.style.visibility = "hidden";
        if (process.env.NODE_ENV !== "production" && window.__musterLiving) window.__musterLiving.rendering = false;
      }
      if (owned && !document.hidden && now - lastDraw >= interval - 1) {
        owned.livingTier(preference.tier);
        const reduced = motionRef.current.mode === "reduced" || Boolean(dev.current?.reduce) || forceReduced;
        owned.draw(clock, { ambient: true, only: "environment", reduced, freezeLiving: freeze });
        background.style.visibility = "visible";
        host.dataset.livingEnvironment = "true";
        lastDraw = now;
        if (process.env.NODE_ENV !== "production")
          window.__musterLiving = {
            time: clock,
            camera: camera(clock).position,
            tier: preference.tier,
            reduced,
            rendering: true,
            pause: () => {
              paused = true;
            },
            play: () => {
              paused = false;
              previous = 0;
            },
            seek: (time) => {
              paused = true;
              clock = Math.max(DURATION, time);
              lastDraw = 0;
            },
            freeze: (value) => {
              freeze = value;
              lastDraw = 0;
            },
            diagnostics: () => owned?.diagnostics,
          };
      }
      raf = requestAnimationFrame(frame);
    };
    const start = async () => {
      if (!owned) {
        try {
          owned = new EmbarkationRenderer(
            document.createElement("canvas"),
            seedFor(roomRef.current.voyage.id),
            experience().tier,
            () => {
              delete host.dataset.livingEnvironment;
            },
            background,
          );
          await owned.preload(roomRef.current.voyage.coverUrl, abort.signal, false, artDirectionRef.current, true);
          if (abort.signal.aborted) {
            owned.dispose();
            return;
          }
          livingRef.current = { renderer: owned, time: clock };
        } catch {
          owned?.dispose();
          owned = null;
          delete host.dataset.livingEnvironment;
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const resize = () => owned?.resize();
    const visibility = () => {
      previous = 0;
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    void start();
    return () => {
      abort.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      owned?.dispose();
      livingRef.current = null;
      delete host.dataset.livingEnvironment;
      if (process.env.NODE_ENV !== "production") delete window.__musterLiving;
    };
  }, [active, forceReduced]);
  const replay = useCallback(() => {
    replayRef.current = true;
    setActive(true);
    setReady(false);
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);
  useLayoutEffect(() => {
    if (!active || !destinationReady || !motion.ready || !authority) return;
    const hostRoot = hostRef.current,
      overlay = overlayRef.current,
      canvas = canvasRef.current;
    const main = hostRoot?.querySelector<HTMLElement>(".muster-scene");
    if (!hostRoot || !overlay || !canvas || !main) return;
    // Replay is reachable below the room on short/mobile viewports. Establish
    // its final framing before measuring the live landing, beneath the overlay.
    if (replayRef.current) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (!dev.current) {
      const q = process.env.NODE_ENV !== "production" ? new URLSearchParams(location.search) : new URLSearchParams();
      const requested = q.get("quality");
      dev.current = {
        inspect: q.get("inspector") === "1",
        scenario: q.get("arrival") ?? "",
        quality: ["CINEMATIC", "BALANCED", "PERFORMANCE"].includes(requested ?? "") ? (requested as Tier) : null,
        reduce: q.get("motion") === "reduced",
        optional: q.get("missing") === "optional",
        rendererFail: q.get("failure") === "renderer",
      };
      setInspect(dev.current.inspect);
    }
    const options = dev.current,
      prefs = experience(),
      tier = tierOverride ?? options.quality ?? prefs.tier;
    let reduced = motion.mode === "reduced" || forceReduced || options.reduce;
    const identity = roomRef.current.arrival?.person ?? { key: "", registered: false, displayName: null };
    const receiptKey = `${identity.key}:${room.voyage.id}`;
    const seen =
      options.scenario === "return" ||
      (options.scenario !== "first" && (roomRef.current.arrival?.seen || localReceipts.has(receiptKey)));
    let duration = entryDuration(Boolean(seen), replayRef.current, reduced),
      time = 0,
      filmTime = 0,
      playing = false,
      speed = 1,
      muted = false,
      only = "",
      debug = false,
      freezeLiving = false,
      projectionGrid = false,
      done = false,
      last = 0,
      raf = 0,
      preparationRaf = 0,
      lastProgress = performance.now();
    const seed = seedFor(room.voyage.id),
      controller = new AbortController(),
      preparationController = new AbortController();
    controller.signal.addEventListener("abort", () => preparationController.abort(), { once: true });
    signalRef.current = controller;
    const startedPreload = performance.now(),
      frames: number[] = [],
      costs: number[] = [],
      longTasks: number[] = [];
    let preloadMs = 0,
      renderer: EmbarkationRenderer | null = null;
    let rendererFailure: string | null = null;
    const audio = new EmbarkationAudio();
    const host = authority.hosts.registerHost({
      kind: "platform-ceremony",
      root: hostRoot,
      hostKey: `embarkation:${room.voyage.id}`,
    });
    let redraw = () => {};
    const landing = new MusterLanding(main, host, () => {
      if (preloadMs > 0) redraw();
    });
    const originalOverflow = document.body.style.overflow;
    const originalGutter = document.documentElement.style.scrollbarGutter;
    if (window.innerWidth > document.documentElement.clientWidth)
      document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    main.inert = true;
    main.setAttribute("aria-hidden", "true");
    const outside = [...document.body.children].filter(
      (n) => n !== hostRoot && !n.contains(hostRoot) && n instanceof HTMLElement,
    ) as HTMLElement[];
    // Next's app root contains both shell and scene; lock shell controls separately.
    const shell = [
      ...document.querySelectorAll<HTMLElement>(".product-shell-header, .shell-contextual-navigation"),
    ].filter((n) => !hostRoot.contains(n));
    const locked = shell.map((n) => ({ n, inert: n.inert, visibility: n.style.visibility, opacity: n.style.opacity }));
    locked.forEach(({ n }) => {
      n.inert = true;
      n.style.visibility = "hidden";
    });
    void outside;
    let perfObserver: PerformanceObserver | null = null;
    try {
      perfObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (playing) longTasks.push(e.duration);
      });
      perfObserver.observe({ type: "longtask", buffered: false });
    } catch {}
    const generic = overlay.querySelector<HTMLElement>(".embarkation-source")!;
    const retained = !replayRef.current ? takeOutgoing(location.pathname) : null;
    if (retained) {
      generic.style.display = "none";
      retained.style.zIndex = "2";
      overlay.append(retained);
    }
    const src = retained ?? generic;
    const diagnostics = () => ({
      program: EMBARKATION_VERSION,
      seed,
      tier,
      duration,
      preloadMs,
      frameCount: frames.length,
      frameP50: percentile(frames, 0.5),
      frameP95: percentile(frames, 0.95),
      frameP99: percentile(frames, 0.99),
      longFrames: frames.filter((n) => n > 32).length,
      renderP95: percentile(costs, 0.95),
      longTasks,
      renderer: renderer?.diagnostics,
      rendererFailure,
      audio: audio.diagnostics(),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      memory: (() => {
        const heap = (
          performance as Performance & {
            memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
          }
        ).memory;
        return heap
          ? { usedBytes: heap.usedJSHeapSize, allocatedBytes: heap.totalJSHeapSize, limitBytes: heap.jsHeapSizeLimit }
          : "unavailable";
      })(),
      gpuLoad: "not directly observable",
      thermal: "not observable in browser",
      camera: {
        position: camera(filmTime).position,
        path: "Forward crossing and island exploration 3900 world units; fog passage 22–27s; backward threshold 27–31s; stationary thereafter",
      },
      landing: landing.rectangles(),
      pageSurfaces: renderer?.sourceDiagnostics(filmTime),
      scene: renderer?.inspectScene(filmTime),
      playbackRate: speed,
    });
    const restore = () => {
      landing.release();
      main.inert = false;
      main.removeAttribute("aria-hidden");
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.scrollbarGutter = originalGutter;
      locked.forEach(({ n, inert, visibility, opacity }) => {
        n.inert = inert;
        n.style.visibility = visibility;
        n.style.opacity = opacity;
      });
      hostRoot.dataset.arrivalActive = "false";
    };
    const finish = async (reason: "completed" | "skipped" | "fallback") => {
      if (done) return;
      done = true;
      playing = false;
      cancelAnimationFrame(raf);
      const saved = diagnostics();
      cancelAnimationFrame(preparationRaf);
      if (preloadMs === 0) preparationController.abort();
      if (renderer && preloadMs > 0) {
        livingRef.current = { renderer, time: Math.max(DURATION, filmTime) };
        hostRoot.dataset.livingEnvironment = "true";
        renderer.draw(DURATION, { ambient: true, only: "environment", reduced });
        renderer.releaseDeparture();
      } else if (renderer) {
        // Preparation can be skipped or time out between texture uploads.
        // Never draw or retain an incomplete compositor during that handoff.
        renderer.dispose();
        renderer = null;
      }
      if (reason === "completed" && frames.length > 120 && duration === DURATION) {
        try {
          const p95 = percentile(frames, 0.95);
          localStorage.setItem(
            "voyagewright.embarkation-auto.v1",
            p95 > 60 ? "PERFORMANCE" : p95 > 32 ? "BALANCED" : "CINEMATIC",
          );
        } catch {
          /* Never required for arrival. */
        }
      }
      const handoff = createSceneFinalStateHandoff({
        sceneInstanceId: `embarkation-${seed}` as SceneInstanceId,
        policy: { kind: "reconcile-then-revert", semanticState: "muster-readable", handoffTargetKey: "muster-title" },
        runtime: {
          reconcileFinalState: () => {
            restore();
            overlay.style.display = "none";
          },
          verifyReadableState: () =>
            main.isConnected &&
            main.getBoundingClientRect().width > 0 &&
            Boolean(main.querySelector("#muster-title")) &&
            !main.inert,
          cleanup: (step) => {
            if (step === "runtime-resources" && livingRef.current?.renderer !== renderer) renderer?.dispose();
            if (step === "ownership-claims") host.release();
          },
        },
      });
      const receipt = await handoff.begin();
      if (controller.signal.aborted) return;
      if (process.env.NODE_ENV !== "production") window.__embarkationLast = { ...saved, receipt, reason };
      ambienceRef.current = audio;
      audio.update(DURATION, experience().audio, experience().volume, false, true);
      setActive(false);
      setReady(false);
      const title = main.querySelector<HTMLElement>("#muster-title");
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
      if (receipt.handoffCompleted && receipt.finalStateCommitted && identity.key) {
        localReceipts.add(receiptKey);
        if ((!options.scenario && !replayRef.current) || options.scenario === "first")
          void fetch(`/api/voyages/${room.voyage.id}/muster/arrival`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": roomRef.current.csrfToken },
            body: JSON.stringify({ program: EMBARKATION_VERSION, readable: true, reason }),
            keepalive: true,
          }).catch(() => undefined);
      }
    };
    finishRef.current = (reason) => {
      void finish(reason);
    };
    const updateHold = () => {
      const progress = holdStart.current === null ? 0 : clamp((performance.now() - holdStart.current) / 3000);
      holdRef.current?.style.setProperty("--hold", `${progress * 100}%`);
      if (progress === 1) {
        holdStart.current = null;
        void finish("skipped");
      }
    };
    const draw = () => {
      if (done) return;
      const start = performance.now();
      const returning = duration === 2 && !reduced;
      filmTime = time;
      hostRoot.dataset.environmentTransit = String(!reduced);
      const shellReveal = reduced || returning ? smooth(0.9, 1.5, time) : smooth(CUT.room, 32.3, time);
      locked.forEach(({ n }) => {
        n.style.visibility = shellReveal > 0 ? "visible" : "hidden";
        n.style.opacity = String(shellReveal);
      });
      if (reduced) {
        canvas.style.visibility = "hidden";
        if (backgroundRef.current) backgroundRef.current.style.visibility = "hidden";
        if (quietRef.current) {
          quietRef.current.style.display = "block";
          quietRef.current.style.opacity = String(1 - smooth(0.65, 1.25, time));
        }
      } else {
        canvas.style.visibility = "visible";
        if (backgroundRef.current) backgroundRef.current.style.visibility = "visible";
        if (quietRef.current) quietRef.current.style.display = "none";
        if (preloadMs > 0)
          renderer?.draw(filmTime, { only, freezeLiving, projectionGrid, ...(returning ? { returnTime: time } : {}) });
      }
      src.dataset.playing = String(time > 0);
      if (retained) retained.style.background = time > 0 ? "transparent" : "#061f23";
      src.style.visibility = returning ? (time > 0.7 ? "hidden" : "visible") : filmTime > 22 ? "hidden" : "visible";
      if (reduced) {
        src.style.opacity = String(1 - smooth(0.05, 0.4, time));
      } else if (returning) {
        src.style.opacity = String(1 - smooth(0.1, 0.65, time));
        src.style.transform = `perspective(1150px) translateZ(${-smooth(0, 0.7, time) * 450}px)`;
      } else {
        src.style.opacity = "1";
        sourceFrame(src, filmTime);
      }
      const focus = focusRef.current;
      if (focus) {
        const opacity = reduced
          ? smooth(0.08, 0.32, time) * (1 - smooth(0.65, 0.88, time))
          : smooth(0.5, 1.45, filmTime) * (1 - smooth(5.8, 7.1, filmTime));
        focus.style.opacity = String(returning || (renderer && !reduced) ? 0 : opacity);
        const depth = reduced ? 0 : -smooth(4.7, 7.1, filmTime) * 2300;
        focus.style.transform = `translate(-50%,-50%) perspective(1150px) translate3d(0,${reduced ? 0 : -smooth(3, 7, filmTime) * 65}px,${depth}px) rotateX(${reduced ? 0 : smooth(4, 7, filmTime) * 8}deg)`;
      }
      const currentPerson = roomRef.current.arrival?.person ?? identity;
      if (welcomeRef.current) {
        const text = welcome(currentPerson, roomRef.current.viewer.isCaptain);
        const heading = welcomeRef.current.querySelector("h2")!;
        if (heading.textContent !== text) heading.textContent = text;
        const captain = welcomeRef.current.querySelector<HTMLElement>("[data-captain]")!;
        captain.style.display = roomRef.current.viewer.isCaptain && currentPerson.registered ? "block" : "none";
        welcomeRef.current.style.opacity = String(
          reduced
            ? smooth(0.94, 1.18, time) * (1 - smooth(1.55, 1.8, time))
            : returning
              ? smooth(0.95, 1.2, time) * (1 - smooth(1.65, 2, time))
              : smooth(CUT.welcomeIn, CUT.welcomeIn + 0.23, filmTime) * (filmTime < CUT.welcomeOut ? 1 : 0),
        );
      }
      if (welcomeRef.current && !reduced && !returning) {
        const depart = smooth(34.1, CUT.welcomeOut, filmTime);
        welcomeRef.current.style.transform = `translate(-50%,-50%) perspective(1150px) translate3d(${depart * depart * 260}px,${-depart * 150}px,${-depart * depart * 22000}px) rotateY(${depart * 45}deg) rotateZ(${-depart * 12}deg)`;
      }
      landing.frame(
        reduced ? CUT.room + smooth(0.75, 1.35, time) * (DURATION - CUT.room) : filmTime,
        returning,
        reduced,
      );
      if (!reduced && !returning) {
        const still = time >= CUT.still;
        main.inert = !still;
        if (still) main.removeAttribute("aria-hidden");
        else main.setAttribute("aria-hidden", "true");
        overlay.style.pointerEvents = still ? "none" : "";
        overlay.setAttribute("aria-modal", String(!still));
        if (holdRef.current) holdRef.current.style.visibility = still ? "hidden" : "visible";
      }
      const global = experience();
      audio.update(returning ? DURATION : filmTime, global.audio && !muted, global.volume, !playing, returning);
      updateHold();
      if (debugRef.current) {
        const dc = debugRef.current,
          ctx = dc.getContext("2d");
        if (ctx) {
          dc.width = innerWidth;
          dc.height = innerHeight;
          if (debug) {
            ctx.strokeStyle = "#76edcf";
            ctx.fillStyle = "#c2fae9";
            ctx.font = "11px monospace";
            for (const target of landing.rectangles()) {
              ctx.strokeRect(target.rect.x, target.rect.y, target.rect.width, target.rect.height);
              ctx.fillText(target.name, target.rect.x, target.rect.y - 3);
            }
            if (renderer) {
              const c = camera(filmTime),
                eye = c.position[2] + 1150;
              ctx.fillStyle = "#061b22ee";
              ctx.fillRect(15, 90, 430, 290);
              ctx.fillStyle = "#f6dfb2";
              ctx.fillText(`CAMERA ${c.position.map((n) => n.toFixed(0)).join(", ")} · forward (0,0,-1)`, 25, 110);
              ctx.fillText(
                `Lens z ${eye.toFixed(0)} · focal target: ${filmTime < CUT.threshold ? "Chronicle horizon" : filmTime < CUT.room ? "threshold" : "Muster"}`,
                25,
                127,
              );
              for (const [i, plane] of environmentPlanes.entries())
                ctx.fillText(
                  `${plane.name}: z ${plane.z} · lens distance ${(eye - plane.z).toFixed(0)}`,
                  25,
                  148 + i * 17,
                );
              for (const [i, a] of renderer.actors.filter((a) => a.hero).entries())
                ctx.fillText(
                  `${a.hero}: z ${poseAt(a, filmTime, innerWidth, innerHeight).position[2].toFixed(0)}`,
                  25,
                  276 + i * 13,
                );
              const depthX = (z: number) => 25 + clamp((z + 13000) / 15000) * 395;
              ctx.strokeStyle = "#487a85";
              ctx.beginPath();
              ctx.moveTo(25, 350);
              ctx.lineTo(420, 350);
              ctx.stroke();
              for (const plane of environmentPlanes) {
                ctx.beginPath();
                ctx.moveTo(depthX(plane.z), 338);
                ctx.lineTo(depthX(plane.z), 361);
                ctx.stroke();
              }
              ctx.fillStyle = "#fff0bc";
              ctx.beginPath();
              ctx.moveTo(depthX(eye) - 7, 350);
              ctx.lineTo(depthX(eye) + 5, 344);
              ctx.lineTo(depthX(eye) + 5, 356);
              ctx.fill();
              ctx.fillText("World Z: forward ← lens → behind", 25, 374);
              for (const actor of renderer.actors.filter((a) => a.hero)) {
                const z = poseAt(actor, filmTime, innerWidth, innerHeight).position[2];
                ctx.fillStyle = actor.hero === "lantern" ? "#ffd066" : "#82e5d2";
                ctx.beginPath();
                ctx.arc(depthX(z), 334, 3, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.strokeStyle = "#76edcf";
              for (const a of renderer.actors.filter((a) => a.hero)) {
                ctx.beginPath();
                for (let t = a.birth; t < a.birth + a.life; t += 0.04) {
                  const v = renderer.project(poseAt(a, t, innerWidth, innerHeight).position, t);
                  ctx.lineTo(v.x, v.y);
                }
                ctx.stroke();
              }
              ctx.strokeStyle = "#ffcf75";
              const scene = renderer.inspectScene(filmTime),
                moon = scene.moon;
              const mx = moon.projected[0] * innerWidth,
                my = (1 - moon.projected[1]) * innerHeight;
              ctx.beginPath();
              ctx.arc(mx, my, 18, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(mx, my + 20);
              ctx.lineTo(mx, innerHeight * 0.9);
              ctx.stroke();
              ctx.fillStyle = "#061b22ee";
              ctx.fillRect(15, 393, 500, 91);
              ctx.fillStyle = "#f6dfb2";
              ctx.fillText(`MOON ${moon.position.map((v) => v.toFixed(0)).join(", ")} · disc + scattering`, 25, 412);
              ctx.fillText(
                `LIGHT ${moon.direction.map((v) => v.toFixed(3)).join(", ")} · registered reflection u ${moon.reflectionSourceX.toFixed(3)}`,
                25,
                431,
              );
              ctx.fillText(
                `FOG banks ${scene.fogBanks.length} · independent forward transport · common celestial state`,
                25,
                450,
              );
              ctx.fillText(
                `STAGE C: planar water / distant sky / separate pier · grid reveals texture registration`,
                25,
                469,
              );
              const f = focusRef.current?.getBoundingClientRect();
              if (f) ctx.strokeRect(f.x, f.y, f.width, f.height);
            }
          }
        }
      }
      costs.push(performance.now() - start);
    };
    redraw = draw;
    const frame = (now: number) => {
      if (done) return;
      try {
        if (playing && !document.hidden) {
          const delta = last ? now - last : 0;
          if (last && delta > 0) frames.push(delta);
          time = Math.min(duration, time + (delta / 1000) * speed);
          lastProgress = now;
        }
        last = now;
        if (playing || holdStart.current !== null) draw();
        if (time >= duration && playing) {
          void finish(reduced ? "fallback" : "completed");
          return;
        }
        raf = requestAnimationFrame(frame);
      } catch {
        degrade();
      }
    };
    const degrade = () => {
      if (done) return;
      renderer?.dispose();
      renderer = null;
      reduced = true;
      duration = 1.8;
      time = 0;
      playing = true;
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const controls: EmbarkationControls = {
      snapshot: () => ({
        time,
        filmTime,
        duration,
        tier,
        seed,
        fps: frames.length ? 1000 / (frames.slice(-60).reduce((a, b) => a + b, 0) / Math.min(60, frames.length)) : 0,
        p95: percentile(frames, 0.95),
        renderMs: percentile(costs, 0.5),
        reduced,
        mute: muted,
        active: renderer
          ? Array.from(
              new Set(
                renderer.actors
                  .filter((a) => poseAt(a, filmTime, innerWidth, innerHeight).alpha > 0.01)
                  .map((a) => a.layer),
              ),
            )
          : ["ceremony"],
      }),
      play: () => {
        playing = true;
        last = 0;
        src.inert = true;
        void audio.unlock(seed, experience().audio, experience().volume);
      },
      pause: () => {
        playing = false;
        holdStart.current = null;
        audio.update(filmTime, false, 0, true);
      },
      restart: () => {
        time = 0;
        playing = true;
        last = 0;
      },
      seek: (t) => {
        time = clamp(t, 0, duration);
        playing = false;
        draw();
      },
      speed: (v) => {
        speed = clamp(v, 0.1, 2);
      },
      quality: (v) => {
        setTierOverride(v);
        setReady(false);
        setRevision((n) => n + 1);
      },
      reduced: (v) => {
        setForceReduced(v);
        setReady(false);
        setRevision((n) => n + 1);
      },
      mute: (v) => {
        muted = v;
      },
      layer: (l) => {
        only = l;
        draw();
      },
      debug: (v) => {
        debug = v;
        draw();
      },
      freezeLiving: (v) => {
        freezeLiving = v;
        draw();
      },
      projection: (v) => {
        projectionGrid = v;
        draw();
      },
      fail: degrade,
    };
    setControls(controls);
    if (process.env.NODE_ENV !== "production") window.__embarkation = { ...controls, diagnostics };
    startRef.current = async () => {
      if (done) return;
      time = 0;
      src.inert = true;
      holdRef.current?.focus({ preventScroll: true });
      await audio.unlock(seed, experience().audio, experience().volume);
      if (done || controller.signal.aborted) return;
      playing = true;
      last = 0;
      lastProgress = performance.now();
    };
    const preload = async () => {
      try {
        if (prefs.audio) audio.prepare(seed);
        const images = [...main.querySelectorAll<HTMLImageElement>("img")].map((img) =>
          img.decode().catch(() => undefined),
        );
        const plate = new Image();
        plate.src = "/images/muster/lantern-room.png";
        images.push(plate.decode());
        if (document.fonts) await document.fonts.ready;
        await Promise.all(images);
        if (controller.signal.aborted || done) return;
        if (!reduced && !options.rendererFail) {
          try {
            renderer = new EmbarkationRenderer(canvas, seed, tier, degrade, backgroundRef.current ?? undefined);
            await renderer.preload(
              roomRef.current.voyage.coverUrl,
              preparationController.signal,
              options.optional,
              artDirectionRef.current,
            );
            if (duration === DURATION) await renderer.captureSource(src, preparationController.signal);
          } catch (cause) {
            rendererFailure = cause instanceof Error ? cause.message : "renderer-unavailable";
            renderer?.dispose();
            renderer = null;
            reduced = true;
            duration = 1.8;
          }
        } else if (options.rendererFail) {
          reduced = true;
          duration = 1.8;
        }
        if (controller.signal.aborted || done) {
          renderer?.dispose();
          return;
        }
        preloadMs = performance.now() - startedPreload;
        setReady(true);
        draw();
        raf = requestAnimationFrame(frame);
        if ((seen || retained) && !replayRef.current) startRef.current();
      } catch {
        if (!controller.signal.aborted && !done) {
          preloadMs = performance.now() - startedPreload;
          reduced = true;
          duration = 1.8;
          setReady(true);
          raf = requestAnimationFrame(frame);
        }
      }
    };
    void preload();
    const preparationFrame = () => {
      if (done || controller.signal.aborted || preloadMs > 0) return;
      updateHold();
      preparationRaf = requestAnimationFrame(preparationFrame);
    };
    preparationRaf = requestAnimationFrame(preparationFrame);
    const timeout = setTimeout(() => {
      if (!controller.signal.aborted && !done && preloadMs === 0) {
        void finish("fallback");
      }
    }, 45000);
    const watchdog = setInterval(() => {
      if (playing && !document.hidden && performance.now() - lastProgress > 2500) void finish("fallback");
    }, 1000);
    const onResize = () => {
      renderer?.resize();
      landing.measure();
      draw();
    };
    const visibility = () => {
      last = 0;
      holdStart.current = null;
      audio.update(filmTime, false, 0);
    };
    const cancelHold = () => {
      holdStart.current = null;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Tab") {
        const focusable = [
          ...hostRoot.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]'),
        ].filter(
          (n) => !n.closest("[inert]") && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden",
        );
        const first = focusable[0],
          end = focusable.at(-1);
        if (first && end && (event.shiftKey ? document.activeElement === first : document.activeElement === end)) {
          event.preventDefault();
          (event.shiftKey ? end : first).focus();
        }
      }
      if (
        event.code === "Space" &&
        (playing || preloadMs === 0) &&
        !(event.target as Element)?.closest(".embarkation-inspector")
      ) {
        event.preventDefault();
        if (!event.repeat && holdStart.current === null) holdStart.current = performance.now();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") cancelHold();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", cancelHold);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      done = true;
      delete hostRoot.dataset.environmentTransit;
      controller.abort();
      clearTimeout(timeout);
      cancelAnimationFrame(preparationRaf);
      clearInterval(watchdog);
      cancelAnimationFrame(raf);
      perfObserver?.disconnect();
      if (ambienceRef.current !== audio) audio.dispose();
      if (livingRef.current?.renderer !== renderer) renderer?.dispose();
      retained?.remove();
      restore();
      host.release();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", cancelHold);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", visibility);
      if (process.env.NODE_ENV !== "production") delete window.__embarkation;
    };
  }, [
    active,
    destinationReady,
    motion.ready,
    motion.mode,
    authority,
    room.voyage.id,
    revision,
    tierOverride,
    forceReduced,
  ]);
  return (
    <div ref={hostRef} className="embarkation-host" data-arrival-active={active}>
      <canvas ref={backgroundRef} className="embarkation-world" aria-hidden="true" />
      {children}
      {active && (
        <div
          ref={overlayRef}
          className="embarkation-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Arrival into your Voyage"
          data-testid="embarkation-film"
        >
          <canvas ref={canvasRef} aria-hidden="true" style={{ zIndex: 3 }} />
          <div ref={quietRef} className="embarkation-quiet" style={{ display: "none" }} />
          <GenericStage room={room} ready={ready} onBegin={() => startRef.current()} />
          <div ref={focusRef} className="embarkation-focus" style={{ opacity: 0 }} aria-hidden="true">
            <h2>
              JOIN THE
              <br />
              ADVENTURE
            </h2>
            <Compass size={38} />
          </div>
          <div ref={welcomeRef} className="embarkation-welcome" style={{ opacity: 0 }} aria-hidden="true">
            <Compass size={35} />
            <h2 />
            <span data-captain>CAPTAIN</span>
          </div>
          <button
            ref={holdRef}
            className="embarkation-hold"
            aria-label="Hold for three seconds to skip arrival. You can also hold Space."
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              holdStart.current = performance.now();
            }}
            onPointerUp={() => {
              holdStart.current = null;
            }}
            onPointerCancel={() => {
              holdStart.current = null;
            }}
            onLostPointerCapture={() => {
              holdStart.current = null;
            }}
          >
            <span aria-hidden="true">»</span>Hold to skip
          </button>
          <canvas ref={debugRef} aria-hidden="true" style={{ zIndex: 7 }} />
        </div>
      )}
      {!active && (
        <button className="embarkation-replay" onClick={replay}>
          Replay Arrival
        </button>
      )}
      {active && inspect && controls && Inspector && (
        <Suspense fallback={null}>
          <Inspector controls={controls} />
        </Suspense>
      )}
    </div>
  );
}

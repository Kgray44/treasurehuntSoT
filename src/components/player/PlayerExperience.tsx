"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { AnimationSceneName } from "@/animation/core/animation-types";
import { AudioCuePlayer, type AudioCueName } from "@/animation/core/audio-cues";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { sectionVariants } from "@/animation/motion/variants";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import {
  isJournalInteractive,
  waitForJournalPhase,
  type JournalOpeningPhase,
} from "@/animation/journal/opening-machine";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";
import { ArtifactInspection } from "./workspace/ArtifactInspection";
import { CompanionHeader } from "./workspace/CompanionHeader";
import { CompanionNavigation, MobileNavigation } from "./workspace/CompanionNavigation";
import { FinaleChamber } from "./workspace/FinaleChamber";
import { JournalWorkspace } from "./workspace/JournalWorkspace";
import { ObjectiveNote } from "./workspace/ObjectiveNote";
import { ShipsLog } from "./workspace/ShipsLog";
import { SideQuestLedger } from "./workspace/SideQuestLedger";
import { TreasureAltar } from "./workspace/TreasureAltar";
import { companionViews, type CompanionView } from "./workspace/types";
import { VoyageChart } from "./workspace/VoyageChart";

const sceneByEvent: Partial<Record<ClientProgressEvent["type"], AnimationSceneName>> = {
  CHAPTER_RELEASED: "chapter-release",
  CHAPTER_SOLVED: "mark-solved",
  ARTIFACT_AWARDED: "artifact-award",
  ARTIFACT_SILHOUETTE_REVEALED: "artifact-award",
  ARTIFACT_CONNECTED: "artifact-connection",
  MAP_LOCATION_REVEALED: "map-reveal",
  MAP_ROUTE_REVEALED: "route-draw",
  SIDE_QUEST_DISCOVERED: "quest-discovery",
  SIDE_QUEST_UPDATED: "quest-discovery",
  SIDE_QUEST_COMPLETED: "quest-complete",
  JOURNAL_ANNOTATION_ADDED: "log-entry",
  PLAYER_LOG_ENTRY_ADDED: "log-entry",
  FINALE_TEASED: "finale-tease",
  FINALE_REQUIREMENT_UPDATED: "finale-requirement",
  CAMPAIGN_PAUSED: "pause",
  CAMPAIGN_RESUMED: "resume",
  STATE_REVERTED: "undo",
};

const cueByEvent: Partial<Record<ClientProgressEvent["type"], AudioCueName>> = {
  CHAPTER_RELEASED: "wax-crack",
  CHAPTER_SOLVED: "stamp-impact",
  ARTIFACT_AWARDED: "artifact-chime",
  MAP_LOCATION_REVEALED: "compass-click",
  MAP_ROUTE_REVEALED: "map-scratch",
  FINALE_TEASED: "mechanism-hum",
  CAMPAIGN_PAUSED: "pause-wind-down",
  STATE_REVERTED: "undo-reverse",
};

function deviceId() {
  let id = localStorage.getItem("forever-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("forever-device", id);
  }
  return id;
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function PlayerExperience({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  const root = useRef<HTMLElement>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<CompanionView>("journal");
  const [openingPhase, setOpeningPhase] = useState<JournalOpeningPhase>("ENTRY_IDLE");
  const [resettingJournal, setResettingJournal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.4);
  const [connection, setConnection] = useState<"connecting" | "live" | "adrift">("connecting");
  const [lastRelease, setLastRelease] = useState<ClientProgressEvent | null>(null);
  const [activeEvent, setActiveEvent] = useState<ClientProgressEvent | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [inspectionOrigin, setInspectionOrigin] = useState<HTMLElement | null>(null);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [textScale, setTextScaleState] = useState(1);
  const [texture, setTextureState] = useState(1);
  const [openingSpeed, setOpeningSpeed] = useState<0.25 | 0.5 | 1>(1);
  const eventChain = useRef<Promise<void>>(Promise.resolve());
  const openingRun = useRef<AbortController | null>(null);
  const openingBusy = useRef(false);
  const seenEvents = useRef(new Set<string>());
  const latestSequence = useRef(initialSnapshot.sequence);
  const audio = useRef(new AudioCuePlayer());
  const { director, snapshot: animation } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();
  const journalReady = isJournalInteractive(openingPhase);

  useEffect(() => {
    const audioEngine = audio.current;
    queueMicrotask(() => {
      const savedMuted = localStorage.getItem("forever-muted") === "true";
      const savedVolume = Number(localStorage.getItem("forever-volume") ?? 0.4);
      setMuted(savedMuted);
      setVolumeState(savedVolume);
      setTextScaleState(Number(localStorage.getItem("forever-text-scale") ?? 1));
      setTextureState(Number(localStorage.getItem("forever-texture") ?? 1));
      audioEngine.setMuted(savedMuted);
      audioEngine.setVolume(savedVolume);
    });
    return () => {
      openingRun.current?.abort();
      audioEngine.close();
    };
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(`/api/player/${initialSnapshot.campaign.slug}/snapshot`, { cache: "no-store" });
    if (!response.ok) throw new Error("The latest voyage state could not be loaded.");
    const next = (await response.json()) as PublicSnapshot;
    latestSequence.current = Math.max(latestSequence.current, next.sequence);
    setSnapshot(next);
    return next;
  }, [initialSnapshot.campaign.slug]);

  const completeEvent = useCallback(
    async (event: ClientProgressEvent) => {
      try {
        await refreshSnapshot();
        if (!event.id.includes(":replay:")) {
          await fetch(`/api/player/${initialSnapshot.campaign.slug}/viewed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id, deviceId: deviceId() }),
          });
        }
      } catch {
        setConnection("adrift");
      }
    },
    [initialSnapshot.campaign.slug, refreshSnapshot],
  );

  const playEvent = useCallback(
    async (event: ClientProgressEvent, replay = false) => {
      if (!root.current) return;
      const scene = sceneByEvent[event.type];
      flushSync(() => {
        if (event.type === "CHAPTER_RELEASED") setLastRelease(event);
        setActiveEvent(event);
      });
      const cue = cueByEvent[event.type];
      if (cue) audio.current.play(cue);
      try {
        if (scene)
          await director.play(scene, {
            root: root.current,
            display: event.payload as Record<string, string | number | boolean>,
            queue: true,
          });
      } catch {
        // Presentation failure must not prevent reconciliation with authoritative state.
      }
      if (!replay) await completeEvent(event);
      setActiveEvent(null);
    },
    [completeEvent, director],
  );

  useEffect(() => {
    const source = new EventSource(
      `/api/player/${initialSnapshot.campaign.slug}/events?after=${latestSequence.current}`,
    );
    const offline = () => setConnection("adrift");
    const online = () => {
      setConnection("connecting");
      void refreshSnapshot()
        .then(() => setConnection("live"))
        .catch(() => setConnection("adrift"));
    };
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("adrift");
    source.addEventListener("progression", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as ClientProgressEvent;
      if (seenEvents.current.has(event.id)) return;
      seenEvents.current.add(event.id);
      latestSequence.current = Math.max(latestSequence.current, event.sequence);
      eventChain.current = eventChain.current.then(() => playEvent(event)).catch(() => undefined);
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [initialSnapshot.campaign.slug, playEvent, refreshSnapshot]);

  useEffect(() => {
    const report = (disconnected = false) =>
      fetch(`/api/player/${snapshot.campaign.slug}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          route: `${location.pathname}#${view}`,
          visibility: document.visibilityState,
          acknowledgedSequence: snapshot.sequence,
          disconnected,
        }),
        keepalive: disconnected,
      }).catch(() => undefined);
    void report();
    const interval = window.setInterval(() => void report(), 20_000);
    const visibility = () => void report();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      void report(true);
    };
  }, [snapshot.campaign.slug, snapshot.sequence, view]);

  useEffect(() => {
    const readLocation = () => {
      const params = new URLSearchParams(location.search);
      const requested = params.get("section") as CompanionView | null;
      setView(requested && companionViews.some((item) => item.key === requested) ? requested : "journal");
      if (process.env.NODE_ENV !== "production") {
        const requestedSpeed = Number(params.get("journalSpeed") ?? 1);
        setOpeningSpeed(requestedSpeed === 0.25 || requestedSpeed === 0.5 ? requestedSpeed : 1);
      }
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, []);

  useEffect(() => {
    if (!journalReady) return;
    const entries: Record<CompanionView, { contentType: string; contentKeys: string[] }> = {
      journal: {
        contentType: "chapter",
        contentKeys: snapshot.chapters.filter((item) => item.unseen).map((item) => String(item.ordinal)),
      },
      chart: {
        contentType: "map",
        contentKeys: snapshot.mapLocations.filter((item) => item.unseen).map((item) => item.key),
      },
      treasures: {
        contentType: "artifact",
        contentKeys: snapshot.artifacts.filter((item) => item.unseen).map((item) => item.key),
      },
      quests: {
        contentType: "quest",
        contentKeys: snapshot.sideQuests.filter((item) => item.unseen).map((item) => item.key),
      },
      log: { contentType: "log", contentKeys: snapshot.log.filter((item) => item.unseen).map((item) => item.key) },
      finale: { contentType: "finale", contentKeys: snapshot.finale.unseen ? [snapshot.finale.state] : [] },
    };
    const entry = entries[view];
    if (!entry.contentKeys.length) return;
    const controller = new AbortController();
    void fetch(`/api/player/${snapshot.campaign.slug}/viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      signal: controller.signal,
    })
      .then(() => refreshSnapshot())
      .catch(() => undefined);
    return () => controller.abort();
  }, [journalReady, refreshSnapshot, snapshot, view]);

  async function openJournal(forceFull = false) {
    if (openingBusy.current || !root.current) return;
    openingBusy.current = true;
    const controller = new AbortController();
    openingRun.current = controller;
    audio.current.stopAll();
    audio.current.unlock();
    const advance = async (phase: JournalOpeningPhase, cue?: AudioCueName) => {
      if (controller.signal.aborted || !root.current) throw new DOMException("Opening interrupted", "AbortError");
      flushSync(() => setOpeningPhase(phase));
      if (cue) audio.current.play(cue);
      await waitForJournalPhase(root.current, phase, mode, controller.signal);
    };
    try {
      if (forceFull) {
        flushSync(() => {
          setResettingJournal(true);
          setView("journal");
          setOpeningPhase("ENTRY_IDLE");
        });
        await nextFrame();
        await nextFrame();
        flushSync(() => setResettingJournal(false));
      }
      await advance("ENTRY_ACTIVATED", "ocean-rise");
      const key = `forever-intro:${snapshot.campaign.slug}`;
      const first = forceFull || sessionStorage.getItem(key) !== "seen";
      try {
        await director.play(first ? "first-arrival" : "session-reentry", { root: root.current, queue: false });
      } catch {
        // The physical state machine remains authoritative if the atmospheric prelude is unavailable.
      }
      await advance("CLOSED_BOOK_REVEAL");
      await advance("LATCH_RELEASING", "brass-latch");
      await advance("COVER_OPENING", "wood-creak");
      await advance("SEALED_PAGE_REVEAL", "seal-pressure");
      await advance("SEAL_BREAKING", "wax-crack");
      await advance("BOOK_SETTLING", "paper-flutter");
      await advance("JOURNAL_READY");
      sessionStorage.setItem(key, "seen");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        flushSync(() => setOpeningPhase("JOURNAL_READY"));
      }
    } finally {
      if (openingRun.current === controller) openingRun.current = null;
      openingBusy.current = false;
    }
  }

  function skipJournalOpening() {
    sessionStorage.setItem(`forever-intro:${snapshot.campaign.slug}`, "seen");
    openingRun.current?.abort();
    director.skip();
    audio.current.stopAll();
    flushSync(() => setOpeningPhase("JOURNAL_READY"));
  }

  function navigate(next: CompanionView) {
    setView(next);
    const url = new URL(location.href);
    url.searchParams.set("section", next);
    history.pushState({}, "", url);
  }

  function toggleMute() {
    setMuted((value) => {
      const next = !value;
      localStorage.setItem("forever-muted", String(next));
      audio.current.setMuted(next);
      return next;
    });
  }
  function setVolume(value: number) {
    setVolumeState(value);
    localStorage.setItem("forever-volume", String(value));
    audio.current.setVolume(value);
  }
  function setTextScale(value: number) {
    setTextScaleState(value);
    localStorage.setItem("forever-text-scale", String(value));
  }
  function setTexture(value: number) {
    setTextureState(value);
    localStorage.setItem("forever-texture", String(value));
  }

  const payloadObjective =
    activeEvent?.type === "CHAPTER_RELEASED" &&
    [
      "ink-objective",
      "ink-riddle",
      "map",
      "active",
      "content-readable",
      "interaction-restored",
      "scene-complete",
    ].includes(animation.label)
      ? String(activeEvent.payload.objective ?? "")
      : null;
  const objective = payloadObjective || snapshot.chapter.objective || "Await the captain's signal.";
  const inspectedArtifact = snapshot.artifacts.find((artifact) => artifact.key === selectedArtifact);
  const animationSequence =
    animation.scene === "first-arrival"
      ? "firstArrival"
      : animation.scene === "session-reentry"
        ? "reentry"
        : (animation.scene ?? "dormant");

  return (
    <main
      ref={root}
      className={`voyage-shell stage-${animation.label} view-${view}${resettingJournal ? " journal-resetting" : ""}`}
      data-cinematic-sequence={animationSequence}
      data-journal-phase={openingPhase}
      data-journal-speed={openingSpeed}
      data-motion-mode={mode}
      style={{ "--player-text-scale": textScale, "--texture-opacity": texture } as React.CSSProperties}
    >
      <div className="ocean-depth" data-scene-part="workspace-light" data-gsap-owned aria-hidden="true">
        <div data-scene-part="sky" data-gsap-owned />
        <div data-scene-part="horizon" data-gsap-owned />
        <div data-scene-part="ocean" data-gsap-owned />
        <div data-scene-part="fog-back" data-gsap-owned />
        <div data-scene-part="fog-front" data-gsap-owned />
      </div>
      <div className="player-lantern" data-scene-part="lantern" data-gsap-owned aria-hidden="true">
        <i />
        <b />
      </div>
      <div
        className="persistent-interface"
        data-opening-actor="persistent-interface"
        aria-hidden={!journalReady}
        inert={!journalReady ? true : undefined}
      >
        <CompanionHeader
          connection={connection}
          muted={muted}
          volume={volume}
          mode={mode}
          textScale={textScale}
          texture={texture}
          canReplay={Boolean(lastRelease)}
          toggleMute={toggleMute}
          setVolume={setVolume}
          cycleMotion={cycle}
          setTextScale={setTextScale}
          setTexture={setTexture}
          replay={() =>
            lastRelease && void playEvent({ ...lastRelease, id: `${lastRelease.id}:replay:${Date.now()}` }, true)
          }
        />
        <CompanionNavigation view={view} unseen={snapshot.unseen} navigate={navigate} />
      </div>
      <div className="persistent-mobile-interface" aria-hidden={!journalReady} inert={!journalReady ? true : undefined}>
        <MobileNavigation view={view} unseen={snapshot.unseen} navigate={navigate} />
      </div>
      {(openingPhase === "ENTRY_IDLE" || openingPhase === "ENTRY_ACTIVATED") && (
        <div className="journal-opening">
          <button className="wax-open" onClick={() => void openJournal()}>
            <span>F</span>
            <strong>Open the journal</strong>
            <small>Sound begins only after you choose</small>
          </button>
        </div>
      )}
      <div className="physical-workspace" aria-hidden={!journalReady} inert={!journalReady ? true : undefined}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="section-transition"
            variants={sectionVariants(mode)}
            initial="initial"
            animate="enter"
            exit="exit"
            onAnimationComplete={(definition) => {
              if (definition === "enter" && journalReady) {
                document.querySelector<HTMLElement>("[data-section-heading]")?.focus({ preventScroll: true });
              }
            }}
            data-animation-owner="motion"
          >
            {view === "journal" && (
              <JournalWorkspace
                snapshot={snapshot}
                mode={mode}
                activeEvent={activeEvent}
                openingPhase={openingPhase}
                interactive={journalReady}
                playbackRate={openingSpeed}
                onPageTurn={() => audio.current.play("page-turn")}
              />
            )}
            {view === "chart" && <VoyageChart snapshot={snapshot} mode={mode} />}
            {view === "treasures" && (
              <TreasureAltar
                snapshot={snapshot}
                inspect={(key, element) => {
                  setInspectionOrigin(element);
                  setSelectedArtifact(key);
                }}
              />
            )}
            {view === "quests" && <SideQuestLedger snapshot={snapshot} mode={mode} />}
            {view === "log" && <ShipsLog snapshot={snapshot} navigate={navigate} />}
            {view === "finale" && <FinaleChamber snapshot={snapshot} mode={mode} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <div
        className="persistent-objective"
        data-opening-actor="objective"
        aria-hidden={!journalReady}
        inert={!journalReady ? true : undefined}
      >
        <ObjectiveNote
          objective={objective}
          chapter={snapshot.chapter.ordinal}
          title={snapshot.chapter.title}
          hintCount={snapshot.chapter.hints?.length ?? 0}
          expanded={objectiveOpen}
          setExpanded={setObjectiveOpen}
          returnToClue={() => navigate("journal")}
        />
      </div>
      <AnimatePresence>
        {inspectedArtifact && (
          <ArtifactInspection
            artifact={inspectedArtifact}
            close={() => setSelectedArtifact(null)}
            restoreFocus={inspectionOrigin}
          />
        )}
      </AnimatePresence>
      {openingPhase !== "ENTRY_IDLE" && !journalReady && (
        <div
          className={`voyage-introduction intro-${animationSequence}`}
          data-opening-actor="introduction"
          role="status"
          aria-live="polite"
        >
          <div className="intro-horizon" data-scene-part="horizon" data-gsap-owned aria-hidden="true" />
          <div className="intro-wave" data-scene-part="ocean" data-gsap-owned aria-hidden="true" />
          <div className="intro-fog" data-scene-part="fog-front" data-gsap-owned aria-hidden="true" />
          <div className="intro-title" data-scene-part="title" data-gsap-owned>
            <span>The Forever Treasure</span>
            <small>Voyage Companion</small>
          </div>
          <div className="intro-emblem" data-scene-part="emblem" data-gsap-owned aria-hidden="true">
            ✦
          </div>
          <p data-scene-part="arrival-copy" data-gsap-owned>
            The journal wakes beneath paired stars.
          </p>
          <div data-scene-part="arrival-action" data-gsap-owned />
          {animation.isPlaying && animation.label !== "dark-sea" && (
            <button onClick={skipJournalOpening}>Skip ceremony</button>
          )}
        </div>
      )}
      {(activeEvent?.type === "CHAPTER_SOLVED" || activeEvent?.type === "STATE_REVERTED") && (
        <div
          className="progression-mark"
          data-scene-part={activeEvent.type === "CHAPTER_SOLVED" ? "solved-stamp" : "undo-mark"}
          data-gsap-owned
          role="status"
        >
          {activeEvent.type === "CHAPTER_SOLVED" ? "SOLVED" : "RESTORED"}
        </div>
      )}
      {activeEvent && <PlayerProgressionProp event={activeEvent} />}
      {animation.isPlaying && animation.scene === "chapter-release" && (
        <div className="ceremony-controls">
          <span>Releasing the first seal · {animation.label.replaceAll("-", " ")}</span>
          <button onClick={() => director.skip()}>Reveal all now</button>
        </div>
      )}
      {!animation.isPlaying && lastRelease && journalReady && (
        <button
          className="replay-control"
          onClick={() => void playEvent({ ...lastRelease, id: `${lastRelease.id}:replay:${Date.now()}` }, true)}
        >
          Replay ceremony
        </button>
      )}
      {!animation.isPlaying && journalReady && (
        <button className="intro-replay-control" onClick={() => void openJournal(true)}>
          Replay introduction
        </button>
      )}
      <AnimationTestButton />
    </main>
  );
}

function PlayerProgressionProp({ event }: { event: ClientProgressEvent }) {
  if (["ARTIFACT_AWARDED", "ARTIFACT_SILHOUETTE_REVEALED"].includes(event.type)) {
    return (
      <div className="player-event-prop artifact-event-prop" aria-hidden="true">
        <div data-scene-part="artifact-light" data-gsap-owned />
        <div data-scene-part="artifact-reveal" data-gsap-owned>
          ✦
        </div>
        <div data-scene-part="artifact-slot-target" />
      </div>
    );
  }
  if (["MAP_LOCATION_REVEALED", "MAP_ROUTE_REVEALED"].includes(event.type)) {
    return (
      <div className="player-event-prop map-event-prop" aria-hidden="true">
        <div data-scene-part="map-fog" data-gsap-owned />
        <svg viewBox="0 0 460 220">
          <path data-scene-part="route-path" data-gsap-owned d="M20 180C140 35 310 40 440 160" />
        </svg>
        <i data-scene-part="map-marker-new" data-gsap-owned>
          ✦
        </i>
      </div>
    );
  }
  if (["ARTIFACT_CONNECTED"].includes(event.type)) {
    return (
      <svg className="player-event-prop connection-event-prop" viewBox="0 0 460 220" aria-hidden="true">
        <path data-scene-part="artifact-connection-path" data-gsap-owned d="M30 170Q230 20 430 170" />
      </svg>
    );
  }
  if (["SIDE_QUEST_DISCOVERED", "SIDE_QUEST_UPDATED", "SIDE_QUEST_COMPLETED"].includes(event.type)) {
    return (
      <div className="player-event-prop quest-event-prop" aria-hidden="true">
        <div data-scene-part="quest-note-new" data-gsap-owned>
          OPTIONAL COURSE
        </div>
        <svg viewBox="0 0 460 220">
          <path data-scene-part="red-thread" data-gsap-owned d="M20 180C150 20 310 35 440 170" />
        </svg>
        <i data-scene-part="quest-stamp" data-gsap-owned>
          COMPLETE
        </i>
      </div>
    );
  }
  if (["JOURNAL_ANNOTATION_ADDED", "PLAYER_LOG_ENTRY_ADDED"].includes(event.type)) {
    return (
      <div
        className="player-event-prop log-event-prop"
        data-scene-part="log-entry-new"
        data-gsap-owned
        aria-hidden="true"
      >
        <i data-scene-part="log-symbol-new" data-gsap-owned>
          ✦
        </i>
      </div>
    );
  }
  if (["FINALE_TEASED", "FINALE_REQUIREMENT_UPDATED"].includes(event.type)) {
    return (
      <div className="player-event-prop finale-event-prop" aria-hidden="true">
        <i data-scene-part="finale-ring-outer" data-gsap-owned />
        <i data-scene-part="finale-ring-inner" data-gsap-owned />
        <svg viewBox="0 0 300 300">
          <path data-scene-part="finale-light-path" data-gsap-owned d="M150 12L278 150 150 288 22 150z" />
        </svg>
      </div>
    );
  }
  return null;
}

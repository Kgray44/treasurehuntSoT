"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { useCeremony } from "./useCeremony";

type View = "journal" | "chart" | "treasure";
function deviceId() {
  let id = localStorage.getItem("forever-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("forever-device", id);
  }
  return id;
}
export function PlayerExperience({ initialSnapshot }: { initialSnapshot: PublicSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<View>("journal");
  const [opened, setOpened] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [connection, setConnection] = useState<"connecting" | "live" | "adrift">("connecting");
  const [reduced, setReduced] = useState(false);
  const [lastRelease, setLastRelease] = useState<ClientProgressEvent | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(`/api/player/${snapshot.campaign.slug}/snapshot`, { cache: "no-store" });
    if (!response.ok) throw new Error("The latest voyage state could not be loaded.");
    setSnapshot(await response.json());
  }, [snapshot.campaign.slug]);
  const complete = useCallback(
    async (event: ClientProgressEvent) => {
      if (event.type === "CHAPTER_RELEASED") setLastRelease(event);
      try {
        await refreshSnapshot();
        if (!event.id.includes(":replay:"))
          await fetch(`/api/player/${snapshot.campaign.slug}/viewed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id, deviceId: deviceId() }),
          });
      } catch {
        setConnection("adrift");
      }
    },
    [refreshSnapshot, snapshot.campaign.slug],
  );
  const ceremony = useCeremony({ reducedMotion: reduced, onComplete: complete });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches || localStorage.getItem("forever-reduced") === "true");
    queueMicrotask(() => {
      setMuted(localStorage.getItem("forever-muted") === "true");
      setVolume(Number(localStorage.getItem("forever-volume") ?? 0.4));
      sync();
    });
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (ceremony.stage !== "seal" || muted || !audioContext.current) return;
    const context = audioContext.current;
    const gain = context.createGain();
    const tone = context.createOscillator();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(92, context.currentTime);
    tone.frequency.exponentialRampToValueAtTime(42, context.currentTime + 0.5);
    gain.gain.setValueAtTime(Math.max(0.001, volume * 0.16), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
    tone.connect(gain).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.56);
  }, [ceremony.stage, muted, volume]);
  const enqueueCeremony = ceremony.enqueue;
  useEffect(() => {
    const source = new EventSource(`/api/player/${snapshot.campaign.slug}/events?after=${snapshot.sequence}`);
    const offline = () => setConnection("adrift");
    const online = () => {
      setConnection("connecting");
      void refreshSnapshot().catch(() => setConnection("adrift"));
    };
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("adrift");
    source.addEventListener("progression", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as ClientProgressEvent;
      if (event.type === "CHAPTER_RELEASED") enqueueCeremony(event);
      else void complete(event);
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [enqueueCeremony, complete, refreshSnapshot, snapshot.campaign.slug, snapshot.sequence]);
  const stageIndex = ceremony.current
    ? Math.max(
        0,
        [
          "omen",
          "attention",
          "seal",
          "parchment",
          "ink-heading",
          "ink-story",
          "ink-objective",
          "ink-riddle",
          "map",
          "active",
        ].indexOf(ceremony.stage),
      )
    : 10;
  const readable = Boolean(snapshot.chapter.title) || (ceremony.current && stageIndex >= 4);
  const content = ceremony.current?.payload ?? snapshot.chapter;
  const objective =
    !ceremony.isPlaying || stageIndex >= 6
      ? String(content.objective ?? "Await the captain’s signal.")
      : String(snapshot.chapter.objective ?? "Await the captain’s signal.");
  function toggleMute() {
    setMuted((value) => {
      localStorage.setItem("forever-muted", String(!value));
      return !value;
    });
  }
  function toggleReduced() {
    setReduced((value) => {
      localStorage.setItem("forever-reduced", String(!value));
      return !value;
    });
  }
  function openJournal() {
    if (!audioContext.current) audioContext.current = new AudioContext();
    void audioContext.current.resume();
    setOpened(true);
  }
  return (
    <main className={`voyage-shell stage-${ceremony.stage}`}>
      <div className="ocean-depth" aria-hidden="true" />
      <header className="companion-bar">
        <div>
          <p className="eyebrow">The Forever Treasure</p>
          <h1>Voyage Companion</h1>
        </div>
        <div className="companion-controls">
          <span className={`connection ${connection}`}>
            {connection === "live" ? "Tide connected" : connection === "adrift" ? "Signal adrift" : "Finding the tide"}
          </span>
          <button onClick={toggleMute} aria-pressed={muted}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <label className="volume-control">
            Volume
            <input
              aria-label="Master volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                localStorage.setItem("forever-volume", String(next));
              }}
            />
          </label>
          <button onClick={toggleReduced} aria-pressed={reduced}>
            Gentle motion
          </button>
          <button onClick={() => document.documentElement.requestFullscreen?.()}>Companion mode</button>
        </div>
      </header>
      {!opened && (
        <div className="journal-opening">
          <button className="wax-open" onClick={openJournal}>
            <span>F</span>
            <strong>Open the journal</strong>
            <small>Sound begins only after you choose</small>
          </button>
        </div>
      )}
      <div className="workspace" aria-hidden={!opened}>
        <aside className={`chart-panel panel ${view === "chart" ? "mobile-current" : ""}`}>
          <PanelTitle index="I" title="Voyage chart" />
          <div className="chart">
            <div className="chart-lines" />
            <div className="fog-bank" />
            {snapshot.mapLocations.map((location) => (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                className="map-marker"
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                key={location.key}
              >
                <span>✦</span>
                <b>{location.name}</b>
              </motion.div>
            ))}
            {ceremony.stage === "map" && (
              <div className="map-marker discovering" style={{ left: "63%", top: "43%" }}>
                <span>✦</span>
                <b>Port Merrick</b>
              </div>
            )}
          </div>
          <p className="panel-note">
            {snapshot.mapLocations.length ? "A new mark stains the chart." : "Fog keeps the first bearing hidden."}
          </p>
        </aside>
        <section className={`journal-panel ${view === "journal" ? "mobile-current" : ""}`} aria-label="Current chapter">
          <div className="book-spine" />
          <div className="page left-page">
            <p className="folio">— {snapshot.chapter.ordinal} —</p>
            <p className="script-note">A course drawn beneath paired stars</p>
            <div className="constellation" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <span />
            </div>
            <p className="margin-verse">
              Keep the moon to larboard
              <br />
              and the promise close.
            </p>
          </div>
          <div className="page right-page">
            <div className={`sealed-content ${readable ? "is-open" : ""}`}>
              {!readable ? (
                <>
                  <p className="eyebrow">Chapter sealed</p>
                  <h2>Awaiting the captain’s signal</h2>
                  <p>The page is quiet. Its ink remains somewhere beyond the horizon.</p>
                  <div className="seal-wrap">
                    <div className="seal-cracks" />
                    <div className="wax-seal">F</div>
                  </div>
                </>
              ) : (
                <>
                  <motion.p className="eyebrow ink-line" animate={{ opacity: stageIndex >= 4 ? 1 : 0 }}>
                    Chapter {snapshot.chapter.ordinal}
                  </motion.p>
                  <motion.h2 className="ink-line" animate={{ opacity: stageIndex >= 4 ? 1 : 0 }}>
                    {String(content.title ?? "")}
                  </motion.h2>
                  <motion.p className="narrative ink-line" animate={{ opacity: stageIndex >= 5 ? 1 : 0 }}>
                    {String(content.narrative ?? "")}
                  </motion.p>
                  <motion.div className="objective-card ink-line" animate={{ opacity: stageIndex >= 6 ? 1 : 0 }}>
                    <span>Present course</span>
                    <strong>{objective}</strong>
                  </motion.div>
                  <motion.blockquote className="riddle ink-line" animate={{ opacity: stageIndex >= 7 ? 1 : 0 }}>
                    {String(content.riddle ?? "")
                      .split("\n")
                      .map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                  </motion.blockquote>
                </>
              )}
            </div>
          </div>
        </section>
        <aside className={`treasure-panel panel ${view === "treasure" ? "mobile-current" : ""}`}>
          <PanelTitle index="II" title="Recovered relics" />
          <div className="artifact-frame">
            {snapshot.artifacts[0] ? (
              <div className="compass-needle">
                <i />
                <b>{snapshot.artifacts[0].name}</b>
              </div>
            ) : (
              <>
                <div className="empty-sigil">◇</div>
                <span>One shape waits in the velvet</span>
              </>
            )}
          </div>
          <div className="side-quest">
            <span>Whispered course</span>
            <b>{snapshot.sideQuest?.state === "UNDISCOVERED" ? "Undiscovered" : snapshot.sideQuest?.title}</b>
          </div>
        </aside>
      </div>
      <div className="objective-dock">
        <span>Current objective</span>
        <strong>{objective}</strong>
        <button onClick={() => setView("journal")}>Return to clue</button>
      </div>
      <nav className="mobile-nav" aria-label="Companion views">
        {(
          [
            ["journal", "Journal"],
            ["chart", "Chart"],
            ["treasure", "Relics"],
          ] as const
        ).map(([key, label]) => (
          <button className={view === key ? "active" : ""} onClick={() => setView(key)} key={key}>
            {label}
          </button>
        ))}
      </nav>
      <AnimatePresence>
        {ceremony.isPlaying && (
          <motion.div
            className="ceremony-controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>Releasing the first seal · {ceremony.stage.replace("-", " ")}</span>
            <button onClick={ceremony.skip}>Reveal all now</button>
          </motion.div>
        )}
      </AnimatePresence>
      {!ceremony.isPlaying && lastRelease && (
        <button className="replay-control" onClick={() => ceremony.replay(lastRelease)}>
          Replay ceremony
        </button>
      )}
    </main>
  );
}
function PanelTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="panel-title">
      <span>{index}</span>
      <h2>{title}</h2>
    </div>
  );
}

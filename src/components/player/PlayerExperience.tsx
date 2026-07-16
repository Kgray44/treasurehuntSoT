"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { cinematicSequences, type CinematicSequenceName } from "@/components/cinematic/sequences";
import { useCinematicTransition, type MotionMode } from "@/components/cinematic/useCinematicTransition";
import { useCeremony } from "./useCeremony";

type View = "journal" | "chart" | "treasures" | "quests" | "log" | "finale";
const views: Array<{ key: View; label: string; symbol: string }> = [
  { key: "journal", label: "Journal", symbol: "¶" },
  { key: "chart", label: "Chart", symbol: "⌖" },
  { key: "treasures", label: "Altar", symbol: "◇" },
  { key: "quests", label: "Ledger", symbol: "☾" },
  { key: "log", label: "Ship’s Log", symbol: "≋" },
  { key: "finale", label: "Finale", symbol: "✺" },
];
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
  const [motionMode, setMotionMode] = useState<MotionMode>("full");
  const reduced = motionMode === "reduced";
  const [lastRelease, setLastRelease] = useState<ClientProgressEvent | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [textureIntensity, setTextureIntensity] = useState(1);
  const audioContext = useRef<AudioContext | null>(null);
  const cinematic = useCinematicTransition(motionMode);
  const playCinematic = cinematic.play;
  const seenAmbientEvents = useRef(new Set<string>());
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
  const ceremony = useCeremony({ reducedMotion: reduced, gentleMotion: motionMode === "gentle", onComplete: complete });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setMotionMode(
        media.matches
          ? "reduced"
          : ((localStorage.getItem("forever-motion") as MotionMode | null) ??
              (localStorage.getItem("forever-reduced") === "true" ? "gentle" : "full")),
      );
    queueMicrotask(() => {
      setMuted(localStorage.getItem("forever-muted") === "true");
      setVolume(Number(localStorage.getItem("forever-volume") ?? 0.4));
      setTextScale(Number(localStorage.getItem("forever-text-scale") ?? 1));
      setTextureIntensity(Number(localStorage.getItem("forever-texture") ?? 1));
      sync();
    });
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
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
      const requested = new URLSearchParams(location.search).get("section") as View | null;
      if (requested && views.some((item) => item.key === requested)) setView(requested);
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
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
      else if (!seenAmbientEvents.current.has(event.id)) {
        seenAmbientEvents.current.add(event.id);
        const sequenceByEvent: Partial<Record<ClientProgressEvent["type"], CinematicSequenceName>> = {
          CHAPTER_PREPARED: "prepare",
          CHAPTER_SOLVED: "solved",
          ARTIFACT_AWARDED: "artifact",
          MAP_LOCATION_REVEALED: "map",
          MAP_ROUTE_REVEALED: "map",
          ARTIFACT_SILHOUETTE_REVEALED: "artifact",
          ARTIFACT_CONNECTED: "artifact",
          SIDE_QUEST_DISCOVERED: "prepare",
          SIDE_QUEST_COMPLETED: "solved",
          FINALE_TEASED: "prepare",
          CAMPAIGN_PAUSED: "pause",
          CAMPAIGN_RESUMED: "resume",
          STATE_REVERTED: "undo",
        };
        const sequence = sequenceByEvent[event.type];
        if (sequence)
          void playCinematic(sequence, cinematicSequences[sequence])
            .then(() => complete(event))
            .catch(() => complete(event));
        else void complete(event);
      }
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      source.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [enqueueCeremony, complete, refreshSnapshot, snapshot.campaign.slug, snapshot.sequence, playCinematic]);
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
    setMotionMode((value) => {
      const next: MotionMode = value === "full" ? "gentle" : value === "gentle" ? "reduced" : "full";
      localStorage.setItem("forever-motion", next);
      localStorage.setItem("forever-reduced", String(next !== "full"));
      return next;
    });
  }
  async function openJournal(forceFull = false) {
    if (!audioContext.current) audioContext.current = new AudioContext();
    void audioContext.current.resume();
    setOpened(true);
    const key = `forever-intro:${snapshot.campaign.slug}`;
    const firstArrival = forceFull || sessionStorage.getItem(key) !== "seen";
    sessionStorage.setItem(key, "seen");
    await cinematic
      .play(
        firstArrival ? "firstArrival" : "reentry",
        firstArrival ? cinematicSequences.firstArrival : cinematicSequences.reentry,
      )
      .catch(() => undefined);
  }
  function navigate(next: View) {
    setView(next);
    const url = new URL(location.href);
    url.searchParams.set("section", next);
    history.pushState({}, "", url);
  }
  useEffect(() => {
    if (!opened) return;
    const entries: Record<View, { contentType: string; contentKeys: string[] }> = {
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
    const timer = window.setTimeout(() => {
      void fetch(`/api/player/${snapshot.campaign.slug}/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      })
        .then(() => refreshSnapshot())
        .catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [opened, refreshSnapshot, snapshot, view]);
  const inspectedArtifact = snapshot.artifacts.find((item) => item.key === selectedArtifact);
  return (
    <main
      className={`voyage-shell stage-${ceremony.stage} cinematic-${cinematic.stage} view-${view}`}
      data-cinematic-sequence={cinematic.name}
      style={{ "--player-text-scale": textScale, "--texture-opacity": textureIntensity } as React.CSSProperties}
    >
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
          <button
            onClick={toggleReduced}
            aria-pressed={motionMode !== "full"}
            aria-label={`Motion: ${motionMode}. Change motion setting`}
          >
            {motionMode === "full" ? "Full motion" : motionMode === "gentle" ? "Gentle motion" : "Reduced motion"}
          </button>
          <button
            onClick={() =>
              document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.()
            }
          >
            Companion mode
          </button>
          <details className="preference-menu">
            <summary>Preferences</summary>
            <label>
              Text size{" "}
              <input
                aria-label="Text size"
                type="range"
                min="0.9"
                max="1.35"
                step="0.05"
                value={textScale}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTextScale(next);
                  localStorage.setItem("forever-text-scale", String(next));
                }}
              />
            </label>
            <label>
              Texture{" "}
              <input
                aria-label="Texture intensity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={textureIntensity}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTextureIntensity(next);
                  localStorage.setItem("forever-texture", String(next));
                }}
              />
            </label>
            <button onClick={() => lastRelease && ceremony.replay(lastRelease)} disabled={!lastRelease}>
              Replay last ceremony
            </button>
          </details>
        </div>
      </header>
      <nav className="companion-navigation" aria-label="Companion sections">
        {views.map((item) => (
          <button
            key={item.key}
            aria-current={view === item.key ? "page" : undefined}
            className={view === item.key ? "active" : ""}
            onClick={() => navigate(item.key)}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.label}
            {snapshot.unseen[item.key] > 0 && <small aria-label={`${snapshot.unseen[item.key]} unseen`}>New</small>}
          </button>
        ))}
      </nav>
      {!opened && (
        <div className="journal-opening">
          <button className="wax-open" onClick={() => void openJournal()}>
            <span>F</span>
            <strong>Open the journal</strong>
            <small>Sound begins only after you choose</small>
          </button>
        </div>
      )}
      <div
        className={`workspace ${!(["journal", "chart", "treasures"] as View[]).includes(view) ? "section-hidden" : ""}`}
        aria-hidden={!opened || !(["journal", "chart", "treasures"] as View[]).includes(view)}
      >
        <aside className={`chart-panel panel ${view === "chart" ? "mobile-current" : ""}`}>
          <PanelTitle index="I" title="Voyage chart" />
          <div className="chart">
            <div className="chart-lines" />
            <div className="fog-bank" />
            {snapshot.mapLocations
              .filter((location) => location.x !== undefined && location.y !== undefined)
              .map((location) => (
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
          <ol className="map-alternative" aria-label="Voyage locations" tabIndex={0}>
            {snapshot.mapLocations.map((location) => (
              <li key={location.key}>
                <strong>{location.name}</strong>
                <span>
                  {location.state.replaceAll("_", " ")}
                  {location.regionLabel ? ` · ${location.regionLabel}` : ""}
                </span>
              </li>
            ))}
          </ol>
          {snapshot.mapRoutes.length > 0 && (
            <ol className="route-list" aria-label="Revealed route segments">
              {snapshot.mapRoutes.map((route) => (
                <li key={route.key}>
                  <span aria-hidden="true">⟶</span>
                  <b>
                    {snapshot.mapLocations.find((item) => item.key === route.fromKey)?.name ?? "Known mark"} to{" "}
                    {snapshot.mapLocations.find((item) => item.key === route.toKey)?.name ?? "Known mark"}
                  </b>
                  {route.annotation && <small>{route.annotation}</small>}
                </li>
              ))}
            </ol>
          )}
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
            <ol className="chapter-index" aria-label="Chapter index" tabIndex={0}>
              {snapshot.chapters.map((chapter) => (
                <li key={chapter.ordinal} className={chapter.ordinal === snapshot.chapter.ordinal ? "current" : ""}>
                  <span>Chapter {chapter.ordinal}</span>
                  <b>{chapter.title ?? chapter.teaser ?? "The page remains sealed"}</b>
                  <small>
                    {chapter.state.replaceAll("_", " ")}
                    {chapter.unseen ? " · new" : ""}
                  </small>
                </li>
              ))}
            </ol>
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
        <aside className={`treasure-panel panel ${view === "treasures" ? "mobile-current" : ""}`}>
          <PanelTitle index="II" title="Recovered relics" />
          <div className="artifact-frame artifact-altar">
            {snapshot.artifacts.some((item) => item.state !== "UNKNOWN") ? (
              snapshot.artifacts.map((artifact) => (
                <button
                  key={artifact.key}
                  className={`altar-position state-${artifact.state.toLowerCase()}`}
                  style={{ left: `${artifact.displayX}%`, top: `${artifact.displayY}%` }}
                  onClick={() => artifact.name && setSelectedArtifact(artifact.key)}
                  aria-label={`${artifact.name ?? artifact.safeName ?? "Unknown artifact"}, ${artifact.state.toLowerCase()}`}
                >
                  <i aria-hidden="true" />
                  <b>{artifact.name ?? artifact.safeName ?? "Unknown"}</b>
                </button>
              ))
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
      {opened && view === "quests" && (
        <section className="companion-section quest-ledger" aria-labelledby="quest-heading">
          <header>
            <p className="eyebrow">Optional mysteries</p>
            <h2 id="quest-heading">Side-Quest Ledger</h2>
            <p>Rumors may enrich the voyage, but never bar the main course.</p>
          </header>
          {snapshot.sideQuests.length ? (
            <div className="quest-pages">
              {snapshot.sideQuests.map((quest) => (
                <article key={quest.key} className={`quest-note state-${quest.state.toLowerCase()}`}>
                  <span>{quest.state.replaceAll("_", " ")}</span>
                  <h3>{quest.title ?? "A whispered rumor"}</h3>
                  <p>{quest.description ?? quest.teaser ?? "Only a safe symbol has appeared."}</p>
                  {quest.objectives && (
                    <ol>
                      {quest.objectives.map((item) => (
                        <li key={item.ordinal} className={item.complete ? "complete" : ""}>
                          {item.body}
                        </li>
                      ))}
                    </ol>
                  )}
                  {quest.reward && (
                    <small>Optional reward · {quest.reward.label ?? quest.reward.type.replaceAll("_", " ")}</small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No optional rumors yet" body="The ledger is ready when a mystery chooses to surface." />
          )}
        </section>
      )}
      {opened && view === "log" && (
        <section className="companion-section ships-log" aria-labelledby="log-heading">
          <header>
            <p className="eyebrow">Chronicle of the voyage</p>
            <h2 id="log-heading">Ship’s Log</h2>
          </header>
          {snapshot.log.length ? (
            <ol className="log-timeline">
              {snapshot.log.map((entry) => (
                <li key={entry.key} className={entry.unseen ? "unseen" : ""}>
                  <span aria-hidden="true">{entry.symbol}</span>
                  <div>
                    <time>
                      {new Date(entry.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                    <h3>{entry.title}</h3>
                    <p>{entry.summary}</p>
                    {entry.section !== "log" && (
                      <button onClick={() => navigate(entry.section)}>
                        Open {views.find((item) => item.key === entry.section)?.label}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="The log awaits its first line"
              body="Player-facing voyage events will be recorded here automatically."
            />
          )}
        </section>
      )}
      {opened && view === "finale" && (
        <section className="companion-section finale-chamber" aria-labelledby="finale-heading">
          <div className="finale-mechanism" aria-hidden="true">
            <i />
            <i />
            <i />
            <b>F</b>
          </div>
          <p className="eyebrow">{snapshot.finale.state.replaceAll("_", " ")}</p>
          <h2 id="finale-heading">The Final Seal</h2>
          <p>
            {snapshot.finale.teaser ??
              "The last pages remain safely chained. Nothing beyond the seal has been entrusted to this companion."}
          </p>
          {snapshot.finale.requirements.length > 0 && (
            <ul className="finale-requirements">
              {snapshot.finale.requirements.map((item) => (
                <li key={item.key}>
                  <span>
                    {item.label}
                    {item.optional ? " · optional" : ""}
                  </span>
                  <div aria-label={`${item.current} of ${item.target}`}>
                    {Array.from({ length: item.target }, (_, index) => (
                      <i key={index} className={index < item.current ? "lit" : ""} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {inspectedArtifact && (
        <div className="artifact-inspection-backdrop" onClick={() => setSelectedArtifact(null)}>
          <section
            className="artifact-inspection"
            role="dialog"
            aria-modal="true"
            aria-labelledby="artifact-name"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-inspection" onClick={() => setSelectedArtifact(null)}>
              Close
            </button>
            <div className="artifact-focus" aria-hidden="true">
              ◇
            </div>
            <p className="eyebrow">{inspectedArtifact.state.replaceAll("_", " ")}</p>
            <h2 id="artifact-name">{inspectedArtifact.name}</h2>
            <p>{inspectedArtifact.description}</p>
            {inspectedArtifact.discoveryText && <blockquote>{inspectedArtifact.discoveryText}</blockquote>}
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{inspectedArtifact.category?.replaceAll("_", " ")}</dd>
              </div>
              {inspectedArtifact.chapterOrdinal && (
                <div>
                  <dt>Journal</dt>
                  <dd>Chapter {inspectedArtifact.chapterOrdinal}</dd>
                </div>
              )}
              {inspectedArtifact.connectedArtifactKey && (
                <div>
                  <dt>Connection</dt>
                  <dd>A released relationship answers elsewhere on the altar.</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      )}
      {opened && cinematic.isPlaying && (
        <div
          className={`voyage-introduction intro-${cinematic.name} intro-stage-${cinematic.stage}`}
          role="status"
          aria-live="polite"
        >
          <div className="intro-horizon" aria-hidden="true" />
          <div className="intro-wave wave-back" aria-hidden="true" />
          <div className="intro-wave wave-front" aria-hidden="true" />
          <div className="intro-fog" aria-hidden="true" />
          <div className="intro-title">
            <span>The Forever Treasure</span>
            <small>Voyage Companion</small>
          </div>
          {cinematic.stage !== "dark-sea" && <button onClick={cinematic.skip}>Skip ceremony</button>}
        </div>
      )}
      <div className={`objective-dock ${objectiveOpen ? "expanded" : ""}`}>
        <span>Current objective</span>
        <strong>{objective}</strong>
        {objectiveOpen && (
          <p>
            Chapter {snapshot.chapter.ordinal}
            {snapshot.chapter.title ? ` · ${snapshot.chapter.title}` : ""}
            {snapshot.chapter.hints?.length
              ? ` · ${snapshot.chapter.hints.length} hint${snapshot.chapter.hints.length === 1 ? "" : "s"} available`
              : " · no released hints"}
          </p>
        )}
        <button onClick={() => setObjectiveOpen((value) => !value)} aria-expanded={objectiveOpen}>
          {objectiveOpen ? "Collapse" : "Review"}
        </button>
        <button aria-label="Return to active clue" onClick={() => navigate("journal")}>
          Return to clue
        </button>
      </div>
      <nav className="mobile-nav" aria-label="Companion views">
        {views.map(({ key, label }) => (
          <button className={view === key ? "active" : ""} onClick={() => navigate(key)} key={key}>
            {label}
            {snapshot.unseen[key] > 0 && <span className="sr-only">, new content</span>}
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
      {!ceremony.isPlaying && !cinematic.isPlaying && opened && (
        <button className="intro-replay-control" onClick={() => void openJournal(true)}>
          Replay introduction
        </button>
      )}
      {process.env.NODE_ENV === "development" && opened && (
        <details className="dev-cinematic player-animation-lab">
          <summary>Animation lab</summary>
          {(Object.keys(cinematicSequences) as CinematicSequenceName[]).map((name) => (
            <button
              key={name}
              onClick={() => void cinematic.play(name, cinematicSequences[name]).catch(() => undefined)}
            >
              {name}
            </button>
          ))}
        </details>
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
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="companion-empty">
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

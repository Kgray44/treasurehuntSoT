import type { PublicLogEntry, ProgressEventType } from "./story";

type LogSource = { id: string; type: string; sequence: number; payload: string; releaseAt: Date };
type OfflineSynchronization = Readonly<{ afterSequence: number; synchronizedAt: Date }>;

const SYNODIC_MONTH_MS = 29.530588853 * 24 * 60 * 60 * 1000;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const moonPhases = [
  "new",
  "waxing-crescent",
  "first-quarter",
  "waxing-gibbous",
  "full",
  "waning-gibbous",
  "last-quarter",
  "waning-crescent",
] as const satisfies readonly PublicLogEntry["moonPhase"][];

/** Server projection from persistent event time; no viewer-clock data is read. */
export function authoritativeMoonPhase(releaseAt: Date): PublicLogEntry["moonPhase"] {
  const age =
    (((releaseAt.getTime() - REFERENCE_NEW_MOON_MS) % SYNODIC_MONTH_MS) + SYNODIC_MONTH_MS) % SYNODIC_MONTH_MS;
  return moonPhases[Math.floor((age / SYNODIC_MONTH_MS) * moonPhases.length)] ?? "new";
}

const copy: Partial<
  Record<
    ProgressEventType,
    {
      title: string;
      summary: string;
      symbol: string;
      importance: PublicLogEntry["importance"];
      section: PublicLogEntry["section"];
      target?: string;
    }
  >
> = {
  CAMPAIGN_STARTED: {
    title: "The voyage began",
    summary: "The companion was opened for a new passage.",
    symbol: "✦",
    importance: "major",
    section: "journal",
  },
  CAMPAIGN_PAUSED: {
    title: "The anchor was lowered",
    summary: "The voyage rests safely until the captain gives word.",
    symbol: "◉",
    importance: "quiet",
    section: "log",
  },
  CAMPAIGN_RESUMED: {
    title: "Sails caught the wind",
    summary: "The voyage is underway once more.",
    symbol: "◈",
    importance: "notable",
    section: "journal",
  },
  CHAPTER_RELEASED: {
    title: "A journal seal opened",
    summary: "A new chapter has been entrusted to the crew.",
    symbol: "¶",
    importance: "major",
    section: "journal",
    target: "ordinal",
  },
  CHAPTER_SOLVED: {
    title: "A mystery yielded",
    summary: "The active chapter has been marked solved.",
    symbol: "✓",
    importance: "major",
    section: "journal",
    target: "ordinal",
  },
  HINT_RELEASED: {
    title: "A navigator’s note arrived",
    summary: "A gentle hint was added beside the current clue.",
    symbol: "✎",
    importance: "notable",
    section: "journal",
    target: "ordinal",
  },
  MAP_LOCATION_REVEALED: {
    title: "Ink appeared on the chart",
    summary: "A safe destination has emerged from the fog.",
    symbol: "⌖",
    importance: "major",
    section: "chart",
    target: "key",
  },
  MAP_ROUTE_REVEALED: {
    title: "A route joined the voyage",
    summary: "Fresh ink now connects two known marks.",
    symbol: "⟶",
    importance: "notable",
    section: "chart",
    target: "key",
  },
  ARTIFACT_SILHOUETTE_REVEALED: {
    title: "An empty setting stirred",
    summary: "The altar hints at a relic still beyond reach.",
    symbol: "◇",
    importance: "notable",
    section: "treasures",
    target: "key",
  },
  ARTIFACT_AWARDED: {
    title: "A treasure came aboard",
    summary: "A recovered artifact now rests upon the altar.",
    symbol: "◆",
    importance: "major",
    section: "treasures",
    target: "key",
  },
  ARTIFACT_CONNECTED: {
    title: "Two relics answered",
    summary: "A safe connection has become visible between artifacts.",
    symbol: "∞",
    importance: "major",
    section: "treasures",
    target: "key",
  },
  SIDE_QUEST_DISCOVERED: {
    title: "A rumor found its page",
    summary: "An optional mystery has entered the ledger.",
    symbol: "☾",
    importance: "notable",
    section: "quests",
    target: "key",
  },
  SIDE_QUEST_UPDATED: {
    title: "The secret ledger changed",
    summary: "An optional trail has gained a new observation.",
    symbol: "✧",
    importance: "notable",
    section: "quests",
    target: "key",
  },
  SIDE_QUEST_COMPLETED: {
    title: "An optional promise was kept",
    summary: "A side mystery has reached its gentle conclusion.",
    symbol: "★",
    importance: "major",
    section: "quests",
    target: "key",
  },
  JOURNAL_ANNOTATION_ADDED: {
    title: "Fresh ink in the margin",
    summary: "A player-facing discovery note was added to the journal.",
    symbol: "✎",
    importance: "quiet",
    section: "journal",
    target: "key",
  },
  PLAYER_LOG_ENTRY_ADDED: {
    title: "The captain recorded a note",
    summary: "A new player-facing entry joined the voyage record.",
    symbol: "≋",
    importance: "quiet",
    section: "log",
    target: "key",
  },
  FINALE_TEASED: {
    title: "The final seal answered",
    summary: "The dormant mechanism shifted, but remains safely sealed.",
    symbol: "✺",
    importance: "major",
    section: "finale",
  },
  FINALE_REQUIREMENT_UPDATED: {
    title: "A final socket glimmered",
    summary: "The sealed mechanism acknowledged the voyage’s progress.",
    symbol: "○",
    importance: "notable",
    section: "finale",
    target: "key",
  },
};

export function eventToLogEntry(
  event: LogSource,
  unseen: boolean,
  offlineSynchronization?: OfflineSynchronization,
): PublicLogEntry | null {
  const template = copy[event.type as ProgressEventType];
  if (!template) return null;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(event.payload);
  } catch {}
  const target = template.target ? payload[template.target] : undefined;
  return {
    key: event.id,
    sequence: event.sequence,
    title: template.title,
    summary: template.summary,
    timestamp: event.releaseAt.toISOString(),
    moonPhase: authoritativeMoonPhase(event.releaseAt),
    symbol: template.symbol,
    importance: template.importance,
    section: template.section,
    ...(typeof target === "string" || typeof target === "number" ? { targetKey: String(target) } : {}),
    ...(offlineSynchronization && event.sequence > offlineSynchronization.afterSequence
      ? {
          synchronization: {
            source: "offline-recovery" as const,
            synchronizedAt: offlineSynchronization.synchronizedAt.toISOString(),
          },
        }
      : {}),
    unseen,
  };
}

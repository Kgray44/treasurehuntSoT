import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type HistoricalEvent = {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  observedAt: string;
};

const appPath = fileURLToPath(new URL("../public/app.js", import.meta.url));
const appSource = readFileSync(appPath, "utf8");
const refreshStart = appSource.indexOf("async function refreshSources()");

function selectRecent(events: HistoricalEvent[]) {
  expect(refreshStart).toBeGreaterThan(0);
  const context = vm.createContext({ Date, Intl, Set, String, Number, Math });
  vm.runInContext(appSource.slice(0, refreshStart), context);
  return vm.runInContext(`conciseRecentChanges(${JSON.stringify(events)})`, context) as HistoricalEvent[];
}

const event = (id: string, kind: string, entityType: string, entityId: string, minute: number): HistoricalEvent => ({
  id,
  kind,
  entityType,
  entityId,
  occurredAt: `2026-08-12T12:${String(minute).padStart(2, "0")}:00.000Z`,
  observedAt: `2026-08-12T12:${String(minute).padStart(2, "0")}:30.000Z`,
});

describe("Bridgewatch concise recent-change panel", () => {
  it("suppresses source and branch polling context when it is the only observed change", () => {
    expect(
      selectRecent([
        event("branch", "BRANCH_HEALTH_CHANGED", "branch", "codex/old", 1),
        event("source", "SOURCE_STATE_CHANGED", "source", "github", 2),
      ]),
    ).toEqual([]);
  });

  it("prioritizes governed transitions, keeps one event per entity, and bounds the panel", () => {
    const events = [
      event("branch", "BRANCH_HEALTH_CHANGED", "branch", "codex/old", 1),
      event("source", "SOURCE_STATE_CHANGED", "source", "github", 2),
      event("project-late", "PROJECT_STATE_CHANGED", "project", "bridgewatch", 10),
      event("project-early", "PROJECT_STATE_CHANGED", "project", "bridgewatch", 9),
      event("phase", "PHASE_STATE_CHANGED", "phase", "bridgewatch:3", 8),
      event("decision", "SOUNDING_LINE_DECISION", "run", "31598563933", 7),
      event("main", "MAIN_ADVANCED", "branch", "main", 6),
      event("milestone", "MILESTONE_STATE_CHANGED", "milestone", "watch-history", 5),
      event("pr", "PULL_REQUEST_MERGED", "pull-request", "49", 4),
      event("worker", "WORKER_BLOCKED", "worker", "observer", 3),
      event("extra", "WORKER_FINISHED", "worker", "extra", 2),
      event("later", "WORKER_STARTED", "worker", "later", 1),
    ];

    const selected = selectRecent(events);

    expect(selected).toHaveLength(8);
    expect(selected.map((item) => item.id)).toEqual([
      "project-late",
      "phase",
      "decision",
      "main",
      "milestone",
      "pr",
      "worker",
      "extra",
    ]);
    expect(selected.some((item) => item.kind === "BRANCH_HEALTH_CHANGED" || item.kind === "SOURCE_STATE_CHANGED")).toBe(
      false,
    );
  });
});

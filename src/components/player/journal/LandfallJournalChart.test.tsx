import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LandfallJournalChart, LandfallJournalProvider } from "./LandfallJournalChart";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

vi.mock("@/components/player/workspace/VoyageChart", () => ({
  VoyageChart: ({ landfallScene }: { landfallScene: { selectedFeatureId?: string } }) => (
    <div data-selected-place={landfallScene.selectedFeatureId}>Released map</div>
  ),
}));
vi.mock("@/components/player/journal/LandfallPresentation", () => ({ LandfallPresentation: () => null }));
vi.mock("@/landfall/offline-web", () => ({
  rememberRevealedChart: async () => null,
  pendingLandfallEvidence: async () => null,
  releaseOfflineAssets: vi.fn(),
  restoreOfflineVoyage: async () => null,
  clearLandfallEvidence: vi.fn(),
  queueLandfallEvidence: vi.fn(),
}));
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "synthetic-controller",
    publishedVersionId: "version-1",
    taleId: "fixture-tale",
    currentSequence: 4,
    definition: landfallFixture,
  },
  { releasedAssets: [], blockId: null, chapterId: null },
);
const watch = vi.fn(() => 17);
const clear = vi.fn();
beforeEach(() => {
  delete window.LandfallNative;
  watch.mockClear();
  clear.mockClear();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: watch, clearWatch: clear },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ available: true, bootstrap }) })),
  );
});

it("native background pauses the shared chart while document visibility remains visible and never resumes automatically", async () => {
  const definition = structuredClone(landfallFixture);
  definition.worldspaces[0].observationPolicy.allowedSources.push("NATIVE_LOCATION");
  definition.waypoints
    .filter((waypoint) => waypoint.worldspaceId === "town")
    .forEach((waypoint) => waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION"));
  const nativeBootstrap = projectPlayerLandfallBootstrap(
    {
      sessionId: bootstrap.sessionId,
      publishedVersionId: "version-1",
      taleId: "fixture",
      currentSequence: 4,
      definition,
    },
    { releasedAssets: [], blockId: null, chapterId: null },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ available: true, bootstrap: nativeBootstrap }) })),
  );
  const operations: string[] = [];
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: async (message) => {
      const { operation } = JSON.parse(message);
      operations.push(operation);
      return operation === "LOCATION_PERMISSION" ? { state: "GRANTED" } : { accepted: true };
    },
  };
  const view = render(journal());
  await screen.findAllByText("Released map");
  fireEvent.click(screen.getAllByRole("button", { name: "Use my location" })[0]);
  await waitFor(() => expect(operations).toContain("LOCATION_START"));
  act(() =>
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "BACKGROUND" } }),
    ),
  );
  await waitFor(() => expect(operations.at(-1)).toBe("LOCATION_STOP"));
  expect(document.visibilityState).toBe("visible");
  const starts = operations.filter((operation) => operation === "LOCATION_START").length;
  act(() =>
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "FOREGROUND" } }),
    ),
  );
  expect(operations.filter((operation) => operation === "LOCATION_START")).toHaveLength(starts);
  view.unmount();
  delete window.LandfallNative;
});

it("two chart surfaces share explicit motion consent, and closing the foreground removes sensor listeners", async () => {
  const definition = structuredClone(landfallFixture);
  definition.context = {
    regions: [
      {
        id: "site",
        worldspaceId: "town",
        mapId: definition.maps[0].id,
        name: "Site",
        kind: "SITE",
        geometry: definition.waypoints[0].geometry,
        privacyClassification: "PUBLIC_REAL_WORLD",
        hiddenUntilRevealed: false,
      },
    ],
    landmarks: [],
  };
  const contextualBootstrap = projectPlayerLandfallBootstrap(
    {
      sessionId: bootstrap.sessionId,
      publishedVersionId: bootstrap.publishedVersionId,
      taleId: "fixture",
      currentSequence: 4,
      definition,
    },
    { releasedAssets: [], blockId: null, chapterId: null },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ available: true, bootstrap: contextualBootstrap }) })),
  );
  const requestPermission = vi.fn(async () => "granted");
  Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: { requestPermission } });
  const listen = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(journal());
  await screen.findAllByText("Released map");
  expect(requestPermission).not.toHaveBeenCalled();
  expect(watch).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Allow motion and heading hints" })[0]);
  await screen.findAllByRole("button", { name: "Stop motion and heading hints" });
  expect(requestPermission).toHaveBeenCalledOnce();
  expect(listen.mock.calls.filter(([name]) => name === "deviceorientation")).toHaveLength(1);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(remove.mock.calls.some(([name]) => name === "deviceorientation")).toBe(true);
  expect(watch).not.toHaveBeenCalled();
  view.unmount();
  listen.mockRestore();
  remove.mockRestore();
  Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: undefined });
});

it("historical contextual replay renders a canonical summary without starting location or motion", async () => {
  const definition = structuredClone(landfallFixture);
  definition.context = {
    regions: [
      {
        id: "site",
        worldspaceId: "town",
        mapId: definition.maps[0].id,
        name: "Site",
        kind: "SITE",
        geometry: definition.waypoints[0].geometry,
        privacyClassification: "PUBLIC_REAL_WORLD",
        hiddenUntilRevealed: false,
      },
    ],
    landmarks: [],
  };
  const historicalBootstrap = projectPlayerLandfallBootstrap(
    {
      sessionId: bootstrap.sessionId,
      publishedVersionId: bootstrap.publishedVersionId,
      taleId: "fixture",
      currentSequence: 4,
      definition,
    },
    {
      releasedAssets: [],
      blockId: null,
      chapterId: null,
      replayOnly: true,
      events: [
        {
          id: "recorded",
          sequence: 1,
          eventType: "landfallWaypointConfirmed",
          payload: {
            waypointId: "town-arrival",
            contextualSummary: { state: "KNOWN", regionId: "site", evidenceCategories: ["POSITION"] },
          },
        },
      ],
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ available: true, bootstrap: historicalBootstrap }) })),
  );
  const view = render(
    <LandfallJournalProvider
      sessionId={bootstrap.sessionId}
      publishedVersionId={bootstrap.publishedVersionId}
      csrfToken="synthetic-csrf"
      enabled
      historical
      revision={4}
      mode="reduced"
      onProgress={() => undefined}
    >
      <LandfallJournalChart />
    </LandfallJournalProvider>,
  );
  await screen.findByText(/Recorded context: known/);
  expect(screen.queryByRole("button", { name: "Use my location" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Allow motion and heading hints" })).toBeNull();
  expect(watch).not.toHaveBeenCalled();
  view.unmount();
});
const journal = (revision = 4) => (
  <LandfallJournalProvider
    sessionId={bootstrap.sessionId}
    publishedVersionId={bootstrap.publishedVersionId}
    csrfToken="synthetic-csrf"
    enabled
    historical={false}
    revision={revision}
    mode="reduced"
    onProgress={() => undefined}
  >
    <LandfallJournalChart />
    <LandfallJournalChart />
  </LandfallJournalProvider>
);
it("search selects only released presentation and never starts acquisition or submits arrival", async () => {
  const view = render(journal());
  await screen.findAllByText("Released map");
  const fetch = vi.mocked(globalThis.fetch);
  const readCount = fetch.mock.calls.length;
  fireEvent.change(screen.getAllByRole("searchbox", { name: "Find a place on your released maps" })[0], {
    target: { value: "Town" },
  });
  fireEvent.click(screen.getByRole("button", { name: "View Town arrival · Town Chart" }));
  expect(screen.getAllByText("Released map")[0]).toHaveAttribute("data-selected-place", "town-arrival");
  expect(screen.getAllByText("Released map")[1]).not.toHaveAttribute("data-selected-place");
  expect(watch).not.toHaveBeenCalled();
  expect(fetch.mock.calls).toHaveLength(readCount);
  fireEvent.change(screen.getAllByRole("searchbox")[0], { target: { value: "Secret Isle" } });
  expect(screen.getByText("No released places match.")).toBeInTheDocument();
  expect(screen.getAllByText("Released map")[0]).not.toHaveAttribute("data-selected-place");
  view.unmount();
});
it("two chart surfaces share one explicit watch; revision and unmount stop it", async () => {
  const view = render(journal());
  await screen.findAllByText("Released map");
  expect(watch).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Use my location" })[0]);
  expect(watch).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("button", { name: "Stop using my location" })).toHaveLength(2);
  view.rerender(journal(5));
  await waitFor(() => expect(clear).toHaveBeenCalledWith(17));
  await screen.findAllByRole("button", { name: "Use my location" });
  fireEvent.click(screen.getAllByRole("button", { name: "Use my location" })[1]);
  expect(watch).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(clear).toHaveBeenCalledTimes(2);
});
it("backgrounding clears position and stops the foreground watch without restarting", async () => {
  const view = render(journal());
  await screen.findAllByText("Released map");
  fireEvent.click(screen.getAllByRole("button", { name: "Use my location" })[0]);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(clear).toHaveBeenCalledWith(17);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(watch).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("revoking offline access aborts a pending chart load and prevents a late projection", async () => {
  let release!: (value: unknown) => void;
  const deferred = new Promise((resolve) => {
    release = resolve;
  });
  const fetch = vi.fn(() => deferred);
  vi.stubGlobal("fetch", fetch);
  const view = render(journal());
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  act(() => window.dispatchEvent(new Event("landfall-offline-cleared")));
  await act(async () => {
    release({ ok: true, json: async () => ({ available: true, bootstrap }) });
  });
  expect(screen.queryByText("Released map")).toBeNull();
  expect(watch).not.toHaveBeenCalled();
  view.unmount();
});

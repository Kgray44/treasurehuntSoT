import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LandfallJournalChart, LandfallJournalProvider } from "./LandfallJournalChart";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

vi.mock("@/components/player/workspace/VoyageChart", () => ({ VoyageChart: () => <div>Released map</div> }));
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
  watch.mockClear();
  clear.mockClear();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: watch, clearWatch: clear },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ available: true, bootstrap }) })),
  );
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

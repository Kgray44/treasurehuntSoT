import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  lifecycle: null as null | ((state: string) => void),
  power: null as null | ((state: { lowPower: boolean; thermalPressure: boolean; state: string }) => void),
}));
vi.mock("@/landfall/native-bridge", () => ({
  subscribeLandfallNativeLifecycle: (callback: typeof mocks.lifecycle) => {
    mocks.lifecycle = callback;
    return () => {
      mocks.lifecycle = null;
    };
  },
  subscribeNativeLandfallPower: (callback: typeof mocks.power) => {
    mocks.power = callback;
    return () => {
      mocks.power = null;
    };
  },
}));
import { LandfallOnlineDataPanel } from "./LandfallOnlineDataPanel";
const definition = structuredClone(landfallFixture);
definition.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "synthetic-session",
    publishedVersionId: "synthetic-pin",
    taleId: "fixture",
    currentSequence: 4,
    definition,
  },
  { releasedAssets: [], chapterId: null, blockId: null },
);
const service = {
  id: "configured-geocoder",
  family: "GEOCODING",
  state: "CONFIGURED",
  recipient: "geo.example.test",
  attributionLabel: "Synthetic geography",
  attributionUrl: "https://geo.example.test/license",
  license: "Synthetic license",
  cacheRights: "PROHIBITED",
  offlineRights: "PROHIBITED",
  authoringRights: "PROHIBITED",
};
const place = {
  id: "synthetic-square",
  label: "Synthetic Square",
  point: { latitude: 40, longitude: -75 },
  source: "EXTERNAL",
  authoritative: false,
  accuracy: "UNKNOWN",
};
const response = (body: unknown) => ({ ok: true, json: async () => body });
const props = { bootstrap, csrfToken: "synthetic-csrf", position: null };
async function configure() {
  fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
  await screen.findByText(/geo.example.test/);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  mocks.fetch.mockImplementation(async (_url, init) =>
    response(
      JSON.parse(init.body).operation === "STATUS"
        ? { state: "STATUS", services: [service] }
        : { state: "RESULT", service, places: [place], canComplete: false },
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("deliberate online data sharing", () => {
  it("shows bounded route and terrain suggestions without claiming arrival, floor or accessibility", async () => {
    const router = { ...service, id: "configured-router", family: "ROUTING", mode: "WALKING" };
    const elevation = { ...service, id: "configured-elevation", family: "ELEVATION" };
    mocks.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init.body);
      return response(
        command.operation === "STATUS"
          ? { state: "STATUS", services: [service, router, elevation] }
          : command.operation === "ROUTE"
            ? {
                state: "RESULT",
                service: router,
                canComplete: false,
                route: {
                  points: [
                    { latitude: 40, longitude: -75 },
                    { latitude: 40.01, longitude: -75.01 },
                  ],
                  distanceMeters: 1200,
                  durationSeconds: 900,
                  mode: "WALKING",
                  source: "EXTERNAL",
                  authoritative: false,
                  safety: "REVIEW_REQUIRED",
                  accessibility: "NOT_ASSESSED",
                },
              }
            : command.operation === "ELEVATION"
              ? {
                  state: "RESULT",
                  service: elevation,
                  canComplete: false,
                  elevation: {
                    point: { latitude: 40, longitude: -75 },
                    meters: 0,
                    source: "EXTERNAL",
                    authoritative: false,
                    uncertainty: "UNKNOWN",
                    floorConfirmed: false,
                    missingCoveragePossible: true,
                  },
                }
              : { state: "RESULT", service, places: [place], canComplete: false },
      );
    });
    render(
      <LandfallOnlineDataPanel
        {...props}
        position={{ coordinates: [-75, 40], observedAt: Date.now(), accuracyMeters: 10, confidence: "OUTSIDE" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
    await screen.findByRole("checkbox");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Synthetic Square" } });
    fireEvent.click(screen.getByRole("button", { name: "Search online places" }));
    fireEvent.click(await screen.findByRole("button", { name: "Synthetic Square" }));
    fireEvent.click(screen.getByRole("button", { name: "Get walking route suggestion to selected place" }));
    await screen.findByRole("img", { name: "Schematic online route without street detail" });
    expect(screen.getByText(/Safety and accessibility have not been assessed/)).toBeInTheDocument();
    expect(JSON.parse(mocks.fetch.mock.calls[2][1].body)).toMatchObject({
      operation: "ROUTE",
      consent: true,
      mode: "WALKING",
      from: { latitude: 40, longitude: -75 },
      to: place.point,
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up terrain at my current location" }));
    await screen.findByText(/a zero value may mean missing coverage/);
    expect(screen.queryByRole("img", { name: "Schematic online route without street detail" })).toBeNull();
  });
  it("makes no requests on mount, blocks private/historical/virtual objectives, and never starts location", () => {
    const view = render(<LandfallOnlineDataPanel {...props} />);
    expect(mocks.fetch).not.toHaveBeenCalled();
    for (const change of [
      { ...bootstrap, paused: true },
      { ...bootstrap, replayOnly: true },
      { ...bootstrap, activeWaypointId: null },
    ]) {
      view.rerender(<LandfallOnlineDataPanel {...props} bootstrap={change} />);
      expect(screen.queryByRole("button", { name: "Check online data options" })).toBeNull();
    }
    for (const classification of ["PRIVATE_REAL_WORLD", "APPROXIMATE_REAL_WORLD", "FICTIONAL"] as const) {
      const changed = structuredClone(bootstrap);
      changed.runtimeDefinition.worldspaces[0].privacyPolicy.classification = classification;
      view.rerender(<LandfallOnlineDataPanel {...props} bootstrap={changed} />);
      expect(screen.queryByRole("button", { name: "Check online data options" })).toBeNull();
    }
    const virtual = {
      ...bootstrap,
      runtimeDefinition: { ...bootstrap.runtimeDefinition, worldspaces: [landfallFixture.worldspaces[1]] },
    };
    view.rerender(<LandfallOnlineDataPanel {...props} bootstrap={virtual} />);
    expect(screen.queryByRole("button", { name: "Check online data options" })).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("checks recipients without coordinates, requires consent and does not autocomplete", async () => {
    render(<LandfallOnlineDataPanel {...props} />);
    await configure();
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ operation: "STATUS" });
    expect(screen.getByRole("button", { name: "Search online places" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Online place search" }), {
      target: { value: "Synthetic Square" },
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Search online places" }));
    await screen.findByRole("button", { name: "Synthetic Square" });
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
      operation: "SEARCH",
      consent: true,
      query: "Synthetic Square",
      limit: 5,
    });
    expect(mocks.fetch.mock.calls[1][1].headers["x-csrf-token"]).toBe("synthetic-csrf");
    fireEvent.click(screen.getByRole("button", { name: "Synthetic Square" }));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByRole("button", { name: "Synthetic Square" })).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
  it("checks position freshness at the sharing action and sends only a valid recent point", async () => {
    const view = render(
      <LandfallOnlineDataPanel
        {...props}
        position={{ coordinates: [-75, 40], accuracyMeters: 10, confidence: "OUTSIDE", observedAt: Date.now() - 31000 }}
      />,
    );
    await configure();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Look up my current location online" }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("A recent location is needed");
    view.rerender(
      <LandfallOnlineDataPanel
        {...props}
        position={{ coordinates: [-75, 40], accuracyMeters: 10, confidence: "OUTSIDE", observedAt: Date.now() }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Look up my current location online" }));
    await screen.findByRole("button", { name: "Synthetic Square" });
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
      operation: "REVERSE",
      consent: true,
      point: { latitude: 40, longitude: -75 },
    });
  });
  it("aborts background work, discards late output, clears consent and never resumes automatically", async () => {
    render(<LandfallOnlineDataPanel {...props} />);
    await configure();
    fireEvent.click(screen.getByRole("checkbox"));
    let complete!: (value: unknown) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Synthetic Square" } });
    fireEvent.click(screen.getByRole("button", { name: "Search online places" }));
    const signal = mocks.fetch.mock.calls[1][1].signal;
    act(() => mocks.lifecycle?.("BACKGROUND"));
    expect(signal.aborted).toBe(true);
    await act(async () => complete(response({ state: "RESULT", service, places: [place], canComplete: false })));
    expect(screen.queryByRole("button", { name: "Synthetic Square" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    act(() => mocks.lifecycle?.("FOREGROUND"));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("clears on scope changes, private storage reset and power pressure", async () => {
    const view = render(<LandfallOnlineDataPanel {...props} />);
    await configure();
    fireEvent.click(screen.getByRole("checkbox"));
    act(() => mocks.power?.({ lowPower: true, thermalPressure: false, state: "READY" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    await configure();
    act(() => window.dispatchEvent(new Event("landfall-offline-cleared")));
    expect(screen.queryByRole("checkbox")).toBeNull();
    await configure();
    view.rerender(<LandfallOnlineDataPanel {...props} bootstrap={{ ...bootstrap, currentSequence: 5 }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("keeps unconfigured and malformed provider responses as readable fallbacks", async () => {
    mocks.fetch.mockResolvedValueOnce(response({ state: "STATUS", services: [] }));
    render(<LandfallOnlineDataPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No online data services are configured"));
    expect(screen.queryByRole("checkbox")).toBeNull();
    mocks.fetch.mockResolvedValueOnce(
      response({ state: "STATUS", services: [{ ...service, attributionUrl: "javascript:alert(1)" }] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Online suggestions are unavailable"));
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

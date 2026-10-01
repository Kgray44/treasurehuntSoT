import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import type { LandfallDefinition } from "@/landfall/schema";
import { LandfallFieldTestPanel } from "@/components/studio/LandfallFieldTestPanel";

const mocks = vi.hoisted(() => ({
  locationStart: vi.fn(),
  locationStop: vi.fn(),
  contextStart: vi.fn(),
  contextStop: vi.fn(),
}));
vi.mock("@/landfall/browser-geolocation", () => ({
  BrowserGeolocationProvider: class {
    active = false;
    start(...args: unknown[]) {
      this.active = true;
      mocks.locationStart(...args);
      (args[2] as (state: string) => void)("GRANTED");
    }
    stop() {
      this.active = false;
      mocks.locationStop();
    }
  },
}));
vi.mock("@/landfall/browser-context", () => ({
  BrowserContextProvider: class {
    start(...args: unknown[]) {
      mocks.contextStart(...args);
      (args[2] as (state: string) => void)("GRANTED");
      return Promise.resolve();
    }
    stop() {
      mocks.contextStop();
    }
  },
}));
const definition: LandfallDefinition = { ...landfallFixture, context: { regions: [], landmarks: [] } };
const props = {
  taleId: "fixture-tale",
  draftId: "draft-1",
  definition,
  worldspaceId: "town",
  mapId: "town-map",
  waypointId: "town-arrival",
  routeId: null,
  csrfToken: "synthetic-csrf",
  sourceVersion: 2,
  unsaved: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(
        async (_url, init) =>
          new Response(
            JSON.stringify(init?.method === "POST" ? { result: "INCOMPLETE", warnings: [] } : { receipts: [] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Creator foreground context field controls", () => {
  it("collects optional hints only after consent and clears lifecycle ownership when source changes", async () => {
    const view = render(<LandfallFieldTestPanel {...props} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Start test walk" }));
    expect(mocks.contextStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop test walk" }));
    fireEvent.click(screen.getByLabelText("Allow optional foreground heading and motion hints for this test"));
    fireEvent.click(screen.getByRole("button", { name: "Start test walk" }));
    expect(mocks.contextStart).toHaveBeenCalledTimes(1);
    expect(mocks.contextStart.mock.calls[0][3]).toBe(true);
    expect(screen.getByLabelText("Allow optional foreground heading and motion hints for this test")).toBeDisabled();
    view.rerender(<LandfallFieldTestPanel {...props} sourceVersion={3} />);
    await screen.findByRole("button", { name: "Start test walk" });
    expect(mocks.contextStop).toHaveBeenCalled();
    expect(mocks.locationStop).toHaveBeenCalled();
    expect(screen.getByLabelText("Allow optional foreground heading and motion hints for this test")).toBeEnabled();
  });

  it("keeps hints transient, saves draft-bound inputs, and does not save receipts offline", async () => {
    render(<LandfallFieldTestPanel {...props} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Allow optional foreground heading and motion hints for this test"));
    fireEvent.click(screen.getByRole("button", { name: "Start test walk" }));
    const [identity, emit] = mocks.contextStart.mock.calls[0];
    emit({
      ...identity,
      id: "synthetic-motion",
      worldspaceId: "town",
      observedAt: new Date().toISOString(),
      kind: "MOTION",
      moving: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save walk receipt" }));
    await screen.findByText(/Sanitized incomplete receipt saved/);
    const posts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
    const input = JSON.parse(String(posts[0][1]?.body));
    expect(input.sourceVersion).toBe(2);
    expect(input.contextualEvidence).toHaveLength(1);
    expect(input.contextualEvidence[0]).toMatchObject({
      kind: "MOTION",
      sessionId: "field-test-draft-1",
      publishedVersionId: "draft-draft-1-2",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save walk receipt" }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2),
    );
    const second = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")[1];
    expect(JSON.parse(String(second[1]?.body)).contextualEvidence).toEqual([]);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent.click(screen.getByRole("button", { name: "Save fallback preview receipt" }));
    expect(await screen.findByText(/Offline: a durable receipt needs a server connection/)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
});

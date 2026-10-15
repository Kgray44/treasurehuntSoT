// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CrossdeckDisplay } from "./CrossdeckDisplay";
import type { CrossdeckConnection } from "./useCrossdeckSession";
import { storageKey } from "@/crossdeck/client";
import { HEARTBEAT_MS } from "@/crossdeck/contracts";
import type { ObjectRef } from "@/crossdeck/sync-contracts";

const mocks = vi.hoisted(() => ({
  resume: null as null | ((object: ObjectRef) => Promise<void>),
  mapReady: true,
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      prefetch,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      prefetch?: boolean;
    }) => {
      void prefetch;
      return React.createElement("a", { ...props, href }, children);
    },
  };
});
vi.mock("./CrossdeckHandoff", () => ({
  CrossdeckHandoff: (props: { resume: typeof mocks.resume }) => {
    mocks.resume = props.resume;
    return null;
  },
}));
vi.mock("@/landfall/map-renderer", async () => {
  const React = await import("react");
  return {
    LandfallMapRenderer: () =>
      mocks.mapReady ? React.createElement("svg", { "aria-label": "Virtual Landfall chart" }) : null,
  };
});

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const rectangle = { width: 600, height: 420, x: 0, y: 0, top: 0, right: 600, bottom: 420, left: 0, toJSON() {} };
const surface = (voyageId = "first") => ({
  surfaceId: "surface",
  voyageId,
  thisSession: true,
  role: "SHARED_CREW_DISPLAY",
  label: "Shared screen",
  presence: "ACTIVE",
});
const ref = (id: string, family: ObjectRef["family"] = "ARTIFACT"): ObjectRef => ({
  family,
  objectId: id,
  version: "released",
});
const reading = (title: string, extra = {}) =>
  Response.json({ title, text: "Synthetic crew content", context: {}, ...extra });
const connection = (overrides = {}) =>
  ({
    voyage: "first",
    ready: true,
    signedOut: false,
    csrf: "csrf",
    busy: false,
    message: "",
    here: surface(),
    act: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as CrossdeckConnection;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.resume = null;
  mocks.mapReady = true;
  mocks.replace.mockClear();
  frames.clear();
  nextFrame = 0;
  sessionStorage.setItem(storageKey("first"), "surface");
  sessionStorage.setItem(storageKey("second"), "surface");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rectangle);
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue(rectangle);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function setup() {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  let olderRequests = 0;
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/api/crossdeck/view?"))
      return url.includes("object=old")
        ? olderRequests++ === 0
          ? pending
          : Promise.resolve(reading("Obsolete view"))
        : Promise.resolve(reading("Current view"));
    if (init?.method === "POST") return Promise.resolve(Response.json({}));
    const voyage = new URL(url, "http://localhost").searchParams.get("voyage") ?? "first";
    return Promise.resolve(Response.json({ csrfToken: "csrf", voyages: [], surfaces: [surface(voyage)] }));
  });
  vi.stubGlobal("fetch", fetcher);
  return { finish, fetcher };
}
async function startResume(object = ref("new")) {
  let promise!: Promise<void>;
  await act(async () => {
    promise = mocks.resume!(object);
  });
  return { promise };
}
async function presentFrame(promise: Promise<void>) {
  await act(async () => vi.advanceTimersByTimeAsync(40));
  expect(frames.size).toBeGreaterThan(0);
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
    await promise;
  });
}

it("keeps an older asynchronous crew-view response from overwriting a newer presentation", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  const current = await startResume();
  await presentFrame(current.promise);
  expect(screen.getByRole("heading", { name: "Current view" })).toBeInTheDocument();
  await act(async () => {
    f.finish(reading("Obsolete view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "Obsolete view" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Current view" })).toBeInTheDocument();
});

it("aborts and clears old crew presentation across Voyage replacement", async () => {
  const f = setup();
  const view = render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  view.rerender(<CrossdeckDisplay voyageId="second" />);
  await act(async () => {
    f.finish(reading("First Voyage view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "First Voyage view" })).not.toBeInTheDocument();
  expect(f.fetcher.mock.calls.find(([url]) => url.includes("object=old"))?.[1]?.signal?.aborted).toBe(true);
});

it("aborts a pending crew view when canonical periodic authorization fails", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  let obsolete!: Promise<void>;
  await act(async () => {
    obsolete = mocks.resume!(ref("old")).catch(() => {});
  });
  const previous = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) =>
    url.startsWith("/api/crossdeck?")
      ? Promise.resolve(Response.json({ error: "access ended" }, { status: 403 }))
      : previous(url, init),
  );
  await act(async () => vi.advanceTimersByTimeAsync(HEARTBEAT_MS));
  await act(async () => {
    f.finish(reading("Revoked view"));
    await obsolete;
  });
  expect(screen.queryByRole("heading", { name: "Revoked view" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Reconnect this display" })).toBeVisible();
  expect(f.fetcher.mock.calls.find(([url]) => url.includes("object=old"))?.[1]?.signal?.aborted).toBe(true);
});

it("keeps standalone participation active through the canonical heartbeat and disconnects on pagehide", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" />);
  await act(async () => {});
  const heartbeats = () => f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(heartbeats()).toHaveLength(1);
  expect(JSON.parse(heartbeats()[0][1]!.body as string)).toMatchObject({
    action: "heartbeat",
    surfaceId: "surface",
    lifecycle: "ACTIVE",
  });
  await act(async () => vi.advanceTimersByTimeAsync(HEARTBEAT_MS));
  expect(heartbeats()).toHaveLength(2);
  await act(async () => window.dispatchEvent(new Event("pagehide")));
  expect(JSON.parse(heartbeats().at(-1)![1]!.body as string)).toMatchObject({ lifecycle: "DISCONNECTED" });
});

it("uses a gateway-owned connection without another participation heartbeat or private Journal request", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  await act(async () => vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2));
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Ready for your crew’s next view" })).toBeVisible();
  expect(screen.queryByRole("link", { name: /Journal/ })).not.toBeInTheDocument();
});

it.each([
  ["loading", { ready: false }],
  ["signed out", { signedOut: true }],
  ["missing surface", { here: undefined }],
  ["another Voyage", { here: { ...surface(), voyageId: "second" } }],
  ["another session", { here: { ...surface(), thisSession: false } }],
  ["personal purpose", { here: { ...surface(), role: "JOURNAL" } }],
])("keeps restricted presentation and personal navigation unavailable while %s", async (_state, overrides) => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection(overrides)} />);
  await act(async () => {});
  expect(mocks.resume).toBeNull();
  expect(screen.queryByRole("button", { name: "Use my Journal companion" })).not.toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(f.fetcher).not.toHaveBeenCalled();
});

it("waits for the matching article content and rendered frame before completing resume", async () => {
  setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  const receipt = await startResume();
  const acknowledged = vi.fn();
  void receipt.promise.then(acknowledged);
  expect(screen.getByRole("article", { name: "Shared crew view" })).toHaveTextContent("Synthetic crew content");
  expect(acknowledged).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(40));
  expect(acknowledged).not.toHaveBeenCalled();
  await presentFrame(receipt.promise);
  expect(acknowledged).toHaveBeenCalledOnce();
});

it("waits for actual map DOM and does not present raw continuity identifiers", async () => {
  mocks.mapReady = false;
  const f = setup();
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation((url, init) =>
    url.includes("/api/crossdeck/view?")
      ? Promise.resolve(
          reading("Crew chart", {
            context: { mapId: "private-map-id", selectedMarkerId: "private-marker-id" },
            scene: {},
          }),
        )
      : original(url, init),
  );
  const active = connection();
  const display = render(<CrossdeckDisplay voyageId="first" connection={active} />);
  const receipt = await startResume(ref("chart", "MAP"));
  const acknowledged = vi.fn();
  void receipt.promise.then(acknowledged);
  await act(async () => vi.advanceTimersByTimeAsync(80));
  expect(frames.size).toBe(0);
  expect(acknowledged).not.toHaveBeenCalled();
  expect(screen.queryByText(/private-map-id|private-marker-id/)).not.toBeInTheDocument();
  mocks.mapReady = true;
  display.rerender(<CrossdeckDisplay voyageId="first" connection={active} />);
  await presentFrame(receipt.promise);
  expect(acknowledged).toHaveBeenCalledOnce();
});

it("rejects a hidden or missing presentation instead of acknowledging a readiness timer", async () => {
  setup();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ ...rectangle, width: 0 });
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  let rejected!: Promise<unknown>;
  await act(async () => {
    rejected = mocks.resume!(ref("new")).catch((cause) => cause);
  });
  await act(async () => vi.advanceTimersByTimeAsync(8000));
  expect(await rejected).toBeInstanceOf(Error);
  expect(frames.size).toBe(0);
  expect(screen.getByRole("alert")).toHaveTextContent("This crew view is not ready");
});

it("keeps an unrendered frame recoverable after the readiness deadline", async () => {
  setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  let rejected!: Promise<unknown>;
  await act(async () => {
    rejected = mocks.resume!(ref("new")).catch((cause) => cause);
  });
  await act(async () => vi.advanceTimersByTimeAsync(40));
  expect(frames.size).toBe(1);
  await act(async () => vi.advanceTimersByTimeAsync(7960));
  expect(await rejected).toBeInstanceOf(Error);
  expect(frames.size).toBe(0);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

it("cancels the pending rendered-frame receipt when the shared role is revoked", async () => {
  setup();
  const active = connection();
  const display = render(<CrossdeckDisplay voyageId="first" connection={active} />);
  let rejected!: Promise<unknown>;
  await act(async () => {
    rejected = mocks.resume!(ref("new")).catch((cause) => cause);
  });
  await act(async () => vi.advanceTimersByTimeAsync(40));
  expect(frames.size).toBe(1);
  display.rerender(
    <CrossdeckDisplay voyageId="first" connection={connection({ here: { ...surface(), role: "JOURNAL" } })} />,
  );
  await act(async () => {
    await rejected;
  });
  expect(await rejected).toBeInstanceOf(Error);
  expect(frames.size).toBe(0);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

it("clears a revoked restricted view on the five-second presentation refresh", async () => {
  const f = setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  const receipt = await startResume();
  await presentFrame(receipt.promise);
  f.fetcher.mockResolvedValue(Response.json({ error: "private" }, { status: 403 }));
  await act(async () => vi.advanceTimersByTimeAsync(4999));
  expect(screen.getByRole("article")).toBeVisible();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("This view is no longer shared with the crew");
  expect(f.fetcher.mock.calls.every(([url]) => url.startsWith("/api/crossdeck/view?"))).toBe(true);
});

it("changes its own role through canonical participation before navigating to the personal companion", async () => {
  const f = setup();
  let finish!: (result: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const active = connection({ act: vi.fn().mockReturnValue(pending) });
  render(<CrossdeckDisplay voyageId="first" connection={active} />);
  fireEvent.click(screen.getByRole("button", { name: "Use my Journal companion" }));
  expect(active.act).toHaveBeenCalledWith(
    { action: "role", surfaceId: "surface", role: "JOURNAL" },
    "Journal companion is ready on this device.",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(f.fetcher).not.toHaveBeenCalled();
  await act(async () => {
    finish({ surface: { ...surface(), role: "JOURNAL" } });
  });
  expect(mocks.replace).toHaveBeenCalledWith("/devices/companion?voyage=first");
  expect(f.fetcher).not.toHaveBeenCalled();
});

it("keeps shared mode when the personal-role change is unavailable", async () => {
  setup();
  const active = connection();
  render(<CrossdeckDisplay voyageId="first" connection={active} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use my Journal companion" })));
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("The Journal companion could not open");
});

it("preserves a rendered crew view when the personal-role change fails", async () => {
  setup();
  render(<CrossdeckDisplay voyageId="first" connection={connection()} />);
  const receipt = await startResume();
  await presentFrame(receipt.promise);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use my Journal companion" })));
  expect(screen.getByRole("article", { name: "Shared crew view" })).toHaveTextContent("Synthetic crew content");
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("does not navigate an obsolete Voyage when its role request completes after unmount", async () => {
  setup();
  let finish!: (result: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const active = connection({ act: vi.fn().mockReturnValue(pending) });
  const display = render(<CrossdeckDisplay voyageId="first" connection={active} />);
  fireEvent.click(screen.getByRole("button", { name: "Use my Journal companion" }));
  display.unmount();
  await act(async () => {
    finish({ surface: { ...surface(), role: "JOURNAL" } });
  });
  expect(mocks.replace).not.toHaveBeenCalled();
});

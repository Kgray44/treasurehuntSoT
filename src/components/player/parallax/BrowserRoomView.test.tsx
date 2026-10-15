import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { syntheticSpatialMoment } from "@/parallax/fixtures";
import { identityTransform, type SpatialMoment } from "@/parallax/contracts";
import type { BrowserTrackingSample } from "@/parallax/browser-world-tracking";
import { BrowserRoomView } from "./BrowserRoomView";

const probe = vi.hoisted(() => ({
  sample: null as null | ((s: BrowserTrackingSample) => void),
  latest: null as BrowserTrackingSample | null,
  rayIndex: 0,
  open: vi.fn(),
  close: vi.fn(),
  planes: true,
  twoViews: false,
}));
vi.mock("@/sextant/camera", () => ({
  BrowserCameraBroker: class {
    acquire = async () => ({ release() {}, stream: {} });
    release() {}
  },
}));
vi.mock("@/parallax/tinyvio-browser-provider", () => ({
  requestBrowserMotionPermission: async () => true,
  TinyvioBrowserProvider: class {
    start = async (input: { sample(s: BrowserTrackingSample): void }) => {
      probe.sample = input.sample;
      input.sample(probe.latest!);
    };
    stop = async () => {};
    read = () => probe.latest;
    cameraIntrinsics = () => ({ width: 320, height: 240, focal: 220 });
    planes = () =>
      probe.planes
        ? [
            {
              id: "map:table",
              alignment: "HORIZONTAL",
              evidence: "DETECTED",
              width: 4,
              depth: 4,
              transform: identityTransform(),
            },
          ]
        : [];
    ray = () => {
      const index = probe.rayIndex++;
      const point = [
        [-1, -0.5],
        [1, -0.5],
        [1, 0.5],
      ][index % 3];
      const origin = { x: probe.twoViews && index >= 3 ? 1 : 0, y: 2, z: 2 };
      const d = { x: point[0] - origin.x, y: -2, z: point[1] - 2 };
      const n = Math.hypot(d.x, d.y, d.z);
      return {
        sessionId: probe.latest!.sessionId,
        origin,
        direction: { x: d.x / n, y: d.y / n, z: d.z / n },
      };
    };
  },
}));
vi.mock("@/parallax/browser-spatial-adapter", () => ({
  BrowserSpatialAdapter: class {
    updateTracking() {}
    stop = async () => {};
  },
}));
const lens = {
  open: probe.open,
  close: probe.close,
  updateDeviceContext: vi.fn(async () => {}),
  read: () => ({ state: "READY" }),
  useGuidedView: vi.fn(async () => {}),
};
const runtime = () => lens as never;
const activeChanged = vi.fn(),
  select = vi.fn();
function moment() {
  const value = syntheticSpatialMoment();
  value.version.studio = {
    environment: {
      features: [
        {
          id: "table",
          name: "Test table",
          classification: "TABLE",
          position: { x: 0, y: 0.5, z: 0 },
          dimensions: [2, 1, 1],
          yawDegrees: 0,
        },
      ],
    },
  } as SpatialMoment["version"]["studio"];
  return value;
}
async function start() {
  render(<BrowserRoomView moment={moment()} runtime={runtime} activeChanged={activeChanged} select={select} />);
  await act(async () => {});
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start browser AR" }));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Alignment method"), { target: { value: "SURFACE" } });
  });
  const camera = screen.getByLabelText("Live rear camera for room alignment").parentElement!;
  vi.spyOn(camera, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 320, height: 240 } as DOMRect);
  return camera;
}
beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
  probe.rayIndex = 0;
  probe.planes = true;
  probe.twoViews = false;
  probe.open.mockReset().mockResolvedValue(undefined);
  probe.close.mockReset().mockResolvedValue(undefined);
  lens.updateDeviceContext.mockReset();
  lens.useGuidedView.mockClear();
  probe.latest = {
    sessionId: "map",
    timestampMs: performance.now(),
    method: "VISUAL_INERTIAL_SLAM",
    status: "TRACKING",
    confidence: "POSITION_NO_SCALE",
    sessionFromCamera: identityTransform(),
    reason: "",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ localPrototype: true, engine: "TINYVIO" })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("opens the canonical scene after three consistent detected-table corners", async () => {
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  expect(probe.open).toHaveBeenCalledOnce();
  expect(screen.getByText("Room alignment complete. Your Chronicle scene is now open.")).toBeVisible();
});

it("opens the canonical scene after both sets of observed corners", async () => {
  probe.twoViews = true;
  const camera = await start();
  fireEvent.change(screen.getByLabelText("Alignment method"), { target: { value: "TWO_VIEWS" } });
  for (let i = 0; i < 6; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  expect(probe.open).toHaveBeenCalledOnce();
  expect(screen.getByText("Room alignment complete. Your Chronicle scene is now open.")).toBeVisible();
});

it("rejects taps outside the fitted camera image without collecting a corner", async () => {
  const camera = await start();
  vi.spyOn(camera, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 300, height: 400 } as DOMRect);
  await act(async () => {
    fireEvent.pointerUp(camera, { clientX: 150, clientY: 20 });
  });
  expect(screen.getByRole("alert")).toHaveTextContent("inside the live camera image");
  expect(probe.rayIndex).toBe(0);
  expect(probe.open).not.toHaveBeenCalled();
});

it("reports a stalled scene opening without waiting for stalled cleanup", async () => {
  const camera = await start();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  probe.open.mockImplementationOnce(() => new Promise(() => {}));
  probe.close.mockImplementation(() => new Promise(() => {}));
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("The scene took too long to open");
  expect(camera).toHaveTextContent("The scene took too long to open");
  expect(screen.getByRole("button", { name: "Restart tracking / recalibrate" })).toBeEnabled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Restart tracking / recalibrate" }));
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("The previous scene could not close");
  expect(screen.getByRole("button", { name: "Restart tracking / recalibrate" })).toBeEnabled();
});
it("explains tracking loss before clearing partially collected corners", async () => {
  const camera = await start();
  await act(async () => {
    fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
  });
  expect(screen.getAllByText(/1 of 3 captured/)[0]).toBeVisible();
  await act(async () => {
    probe.sample!({
      ...probe.latest!,
      sessionId: "new-map",
      status: "LOST",
      reason: "Insufficient features",
      confidence: "NONE",
      sessionFromCamera: null,
    });
  });
  expect(screen.getAllByText(/Your corner taps were cleared/)[0]).toBeVisible();
  expect(screen.getAllByText(/0 of 3 captured/)[0]).toBeVisible();
  expect(probe.open).not.toHaveBeenCalled();
});
it("shows a recoverable error above the camera when no detected surface exists", async () => {
  probe.planes = false;
  const camera = await start();
  await act(async () => {
    fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
  });
  expect(screen.getByRole("alert")).toHaveTextContent("No detected tabletop");
  expect(probe.open).not.toHaveBeenCalled();
});
it("shows renderer failure instead of announcing completed alignment", async () => {
  probe.open.mockRejectedValueOnce(new Error("Renderer unavailable"));
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  expect(screen.getByRole("alert")).toHaveTextContent("Renderer unavailable");
  expect(screen.queryByText("Room alignment complete. Your Chronicle scene is now open.")).toBeNull();
});

it("does not open or close over Guided when calibration context finishes late", async () => {
  let resolve!: () => void;
  lens.updateDeviceContext.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Use Guided View" }));
  });
  const closes = probe.close.mock.calls.length;
  await act(async () => {
    resolve();
  });
  expect(lens.useGuidedView).toHaveBeenCalledOnce();
  expect(probe.open).not.toHaveBeenCalled();
  expect(probe.close).toHaveBeenCalledTimes(closes);
});

it("does not close Guided when a previous browser renderer rejects late", async () => {
  let reject!: (cause: Error) => void;
  probe.open.mockImplementationOnce(
    () =>
      new Promise<void>((_done, fail) => {
        reject = fail;
      }),
  );
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Use Guided View" }));
  });
  const closes = probe.close.mock.calls.length;
  await act(async () => {
    reject(new Error("Old renderer failed"));
  });
  expect(probe.close).toHaveBeenCalledTimes(closes);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("abandons a pending calibration when the tracker changes maps", async () => {
  let resolve!: () => void;
  lens.updateDeviceContext.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  await act(async () => {
    probe.latest = { ...probe.latest!, sessionId: "map-2", timestampMs: performance.now() };
    probe.sample!(probe.latest);
    resolve();
  });
  expect(probe.open).not.toHaveBeenCalled();
  expect(screen.getAllByText(/Your corner taps were cleared/)[0]).toBeVisible();
  expect(screen.getByRole("button", { name: "Restart tracking / recalibrate" })).toBeEnabled();
});

it("invalidates pending calibration on backgrounding without relying on a provider callback", async () => {
  let resolve!: () => void;
  lens.updateDeviceContext.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const camera = await start();
  for (let i = 0; i < 3; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  await act(async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    resolve();
  });
  expect(probe.open).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Restart tracking / recalibrate" })).toBeEnabled();
});

it("keeps the first view when second-view triangulation needs more sideways movement", async () => {
  const camera = await start();
  fireEvent.change(screen.getByLabelText("Alignment method"), { target: { value: "TWO_VIEWS" } });
  for (let i = 0; i < 6; i++)
    await act(async () => {
      fireEvent.pointerUp(camera, { clientX: 1, clientY: 1 });
    });
  expect(screen.getByRole("alert")).toHaveTextContent("Move sideways");
  expect(screen.getByText(/second view, then tap the same corner 1/)).toBeVisible();
  expect(probe.open).not.toHaveBeenCalled();
});

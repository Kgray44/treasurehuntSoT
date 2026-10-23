import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChronicleLens, ChronicleLensDeviceLab } from "./ChronicleLens";
import { syntheticBinding, syntheticSpatialMoment } from "@/parallax/fixtures";
import { NativeDeviceLabSpatialAdapter } from "@/parallax/native-device-lab";
import { evaluateSpatialEvidence } from "@/parallax/evidence";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function host(lab = false) {
  const request = vi.fn(async (message: string) => {
    const { operation, payload } = JSON.parse(message);
    if (operation === "SPATIAL_START")
      return { accepted: true, sceneTransferVersion: lab ? 2 : 1, sessionId: payload.sessionId, epoch: payload.epoch };
    if (["SPATIAL_STATE", "SPATIAL_PERMISSION"].includes(operation))
      return lab
        ? {
            supported: false,
            permission: "DENIED",
            sceneTransferVersion: 1,
            sceneDeliveryVersions: [1, 2],
            capabilities: ["MODEL_GLB"],
            softwareFixture: "SCENEKIT_CAMERA_FREE_V1",
          }
        : { supported: true, permission: "GRANTED", sceneTransferVersion: 1 };
    return { accepted: true };
  });
  window.LandfallNative = { version: 1, platform: "IOS", request };
  const messages = () => request.mock.calls.map(([message]) => JSON.parse(message));
  return {
    request,
    messages,
    identity: () =>
      messages()
        .filter((m) => m.operation === "SPATIAL_START")
        .at(-1).payload,
  };
}
function event(identity: Record<string, unknown>, interactionType: string, extra = {}) {
  fireEvent(
    window,
    new CustomEvent("landfall-native-event", {
      detail: {
        type: "parallax-interaction",
        sessionId: identity.sessionId,
        epoch: identity.epoch,
        entityId: "captains-note",
        interactionType,
        ...extra,
      },
    }),
  );
}
async function camera(provider: ReturnType<typeof host>) {
  fireEvent.click(await screen.findByRole("button", { name: "Use camera for local placement" }));
  await screen.findByText("Camera View");
  for (let i = 0; i < 3; i++)
    fireEvent(
      window,
      new CustomEvent("landfall-native-event", {
        detail: {
          type: "parallax-tracking",
          state: "NORMAL",
          sessionId: provider.identity().sessionId,
          epoch: provider.identity().epoch,
        },
      }),
    );
  await waitFor(() => expect(screen.getByRole("button", { name: "Inspect" })).toBeEnabled());
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  delete window.LandfallNative;
  vi.restoreAllMocks();
});

it("queues native PICK then Inspect, waits for canonical results, and returns the exact inspected object to Player", async () => {
  const provider = host(),
    first = deferred(),
    second = deferred();
  const record = vi
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={() => {}}
    />,
  );
  await camera(provider);
  event(provider.identity(), "PICK");
  event(provider.identity(), "INSPECT");
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Camera View")).toBeVisible();
  await act(async () => first.resolve());
  await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
  expect(record.mock.calls.map(([r]) => r.interactionType)).toEqual(["PICK", "INSPECT"]);
  expect(screen.getByText("Camera View")).toBeVisible();
  expect(provider.messages().filter((m) => m.operation === "SPATIAL_STOP")).toHaveLength(0);
  expect(screen.queryByText(/You are inspecting/)).toBeNull();
  expect(screen.queryByText(/Interaction recorded/)).toBeNull();
  await act(async () => second.resolve());
  await screen.findByText("Guided View");
  expect(screen.getByText(/You are inspecting The Captain/)).toBeVisible();
  expect(screen.getByText(/Interaction recorded/)).toBeVisible();
  expect(screen.queryByText("Retry recording interaction")).toBeNull();
  expect(provider.messages().filter((m) => m.operation === "SPATIAL_STOP")).toHaveLength(1);
  for (const [receipt] of record.mock.calls)
    expect(receipt).toMatchObject({
      sessionId: syntheticBinding.sessionId,
      actorId: syntheticBinding.actorId,
      blockId: syntheticBinding.blockId,
      mode: "NATIVE",
      synthetic: false,
      authority: "NONAUTHORITATIVE",
    });
});

it("returns a failed native Inspect to visible Player error and retries the identical canonical receipt", async () => {
  const provider = host(),
    record = vi.fn().mockRejectedValueOnce(new Error("Canonical service unavailable")).mockResolvedValue(undefined);
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={() => {}}
    />,
  );
  await camera(provider);
  event(provider.identity(), "INSPECT");
  await screen.findByText("Guided View");
  expect(await screen.findByRole("alert")).toHaveTextContent("Canonical service unavailable");
  expect(screen.queryByText(/You are inspecting/)).toBeNull();
  expect(screen.queryByText(/Interaction recorded/)).toBeNull();
  fireEvent.click(screen.getByText("Retry recording interaction"));
  await screen.findByText(/Interaction recorded/);
  expect(screen.getByText(/You are inspecting/)).toBeVisible();
  expect(record.mock.calls[1][0]).toEqual(record.mock.calls[0][0]);
});

it("does not let a completed old POST or stale intent stop or mark a reopened native Lens", async () => {
  const provider = host(),
    pending = deferred(),
    record = vi.fn(() => pending.promise);
  const previous = render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={() => {}}
    />,
  );
  await camera(provider);
  const old = provider.identity();
  event(old, "INSPECT");
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  previous.unmount();
  const currentRecord = vi.fn();
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={currentRecord}
      onClose={() => {}}
    />,
  );
  await camera(provider);
  const fresh = provider.identity();
  await act(async () => pending.resolve());
  event(old, "INSPECT");
  await act(async () => {});
  expect(screen.getByText("Camera View")).toBeVisible();
  expect(screen.queryByText(/Interaction recorded/)).toBeNull();
  expect(screen.queryByText(/You are inspecting/)).toBeNull();
  expect(currentRecord).not.toHaveBeenCalled();
  expect(
    provider.messages().filter((m) => m.operation === "SPATIAL_STOP" && m.payload.sessionId === fresh.sessionId),
  ).toHaveLength(0);
});

it("revalidates the released actor and clears native presentation before sending an interaction for a changed binding", async () => {
  const provider = host(),
    record = vi.fn();
  const bound = { moment: syntheticSpatialMoment(), binding: syntheticBinding, replayOnly: false };
  let current = bound;
  const loadBinding = vi.fn(async () => current);
  render(<ChronicleLens {...bound} loadBinding={loadBinding} record={record} onClose={() => {}} />);
  await camera(provider);
  current = { ...bound, binding: { ...syntheticBinding, actorId: "foreign-player" } };
  event(provider.identity(), "INSPECT");
  await screen.findByText("This Lens is closed. Return to your Journal.");
  expect(record).not.toHaveBeenCalled();
  expect(screen.queryByText(/The next bearing is written/)).toBeNull();
  expect(provider.messages().some((m) => m.operation === "SPATIAL_STOP")).toBe(true);
});

it("admits camera-free input only through explicit Device Lab injection and exposes canonical simulation rejection in Player", async () => {
  const provider = host(true),
    moment = syntheticSpatialMoment();
  const record = vi.fn(async (receipt) => {
    evaluateSpatialEvidence(receipt, moment, syntheticBinding, new Date());
  });
  render(
    <ChronicleLensDeviceLab
      moment={moment}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={() => {}}
      createAdapter={(selected) => new NativeDeviceLabSpatialAdapter(selected)}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Open camera-free Device Lab" }));
  await screen.findByText("Camera-free Device Lab");
  await waitFor(() => expect(screen.getByRole("button", { name: "Inspect" })).toBeEnabled());
  const identity = provider.identity();
  event(identity, "INSPECT");
  event(identity, "INSPECT", { type: "parallax-lab-interaction", synthetic: false });
  event({ ...identity, epoch: 999 }, "INSPECT", { type: "parallax-lab-interaction", synthetic: true });
  await act(async () => {});
  expect(record).not.toHaveBeenCalled();
  event(identity, "INSPECT", { type: "parallax-lab-interaction", synthetic: true });
  expect(await screen.findByRole("alert")).toHaveTextContent("PARALLAX_SIMULATION_FORBIDDEN");
  await screen.findByText("Guided View");
  expect(record.mock.calls[0][0]).toMatchObject({ mode: "SIMULATED", synthetic: true });
  expect(screen.queryByText(/Interaction recorded/)).toBeNull();
  expect(provider.messages().some((m) => ["SPATIAL_PERMISSION", "SPATIAL_PLACE"].includes(m.operation))).toBe(false);
  expect(provider.messages().some((m) => m.operation === "SPATIAL_STOP")).toBe(true);
});

it("keeps an ordinary Player Lens Guided when a native host only advertises the camera-free fixture", async () => {
  const provider = host(true),
    record = vi.fn();
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={() => {}}
    />,
  );
  await screen.findByText("This device uses Guided View for this spatial moment.");
  await waitFor(() => expect(provider.request).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: /Use camera|Open camera-free/ })).toBeNull();
  event({ sessionId: "invented", epoch: 1 }, "INSPECT", { type: "parallax-lab-interaction", synthetic: true });
  expect(record).not.toHaveBeenCalled();
  expect(provider.messages().some((m) => m.operation === "SPATIAL_START")).toBe(false);
});

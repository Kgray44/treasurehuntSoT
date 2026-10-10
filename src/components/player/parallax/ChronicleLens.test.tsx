import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChronicleLens } from "./ChronicleLens";
import { syntheticSpatialMoment, syntheticBinding } from "@/parallax/fixtures";
beforeEach(() => {
  cleanup();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
it("opens camera-free Guided View with readable meaning and keyboard controls", async () => {
  const record = vi.fn().mockResolvedValue(undefined),
    close = vi.fn();
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      record={record}
      onClose={close}
    />,
  );
  await screen.findByText("This device uses Guided View for this spatial moment.");
  expect(screen.getByText(/The next bearing is written/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(record.mock.calls[0][0]).toMatchObject({ authority: "NONAUTHORITATIVE", mode: "GUIDED" });
  expect(screen.getByText(/You are inspecting/)).toBeVisible();
  fireEvent.click(screen.getByLabelText("Close Chronicle Lens"));
  expect(close).toHaveBeenCalled();
});
it("replays locally without submitting evidence or changing progression", async () => {
  const record = vi.fn();
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly
      record={record}
      onClose={() => {}}
    />,
  );
  await screen.findByText("This device uses Guided View for this spatial moment.");
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  await screen.findByText("Revisited. Your Voyage progress stays the same.");
  expect(record).not.toHaveBeenCalled();
});
it("retries the same receipt after failure rather than issuing a fresh interaction", async () => {
  const record = vi.fn().mockRejectedValueOnce(new Error("Waiting for connection")).mockResolvedValue(undefined);
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
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Retry recording interaction"));
  await screen.findByText(/Interaction recorded/);
  expect(record.mock.calls[1][0]).toEqual(record.mock.calls[0][0]);
});

afterEach(() => {
  cleanup();
  delete window.LandfallNative;
  vi.restoreAllMocks();
});
it("keeps native presentation active when its WebView hides, and stops on actual app background", async () => {
  const request = vi.fn(async (message: string) => {
    const { operation, payload } = JSON.parse(message);
    if (operation === "SPATIAL_START")
      return { accepted: true, sceneTransferVersion: 1, sessionId: payload.sessionId, epoch: payload.epoch };
    return ["SPATIAL_STATE", "SPATIAL_PERMISSION"].includes(operation)
      ? { supported: true, permission: "GRANTED", sceneTransferVersion: 1 }
      : { accepted: true };
  });
  window.LandfallNative = { version: 1, platform: "IOS", request };
  render(
    <ChronicleLens
      moment={syntheticSpatialMoment()}
      binding={syntheticBinding}
      replayOnly={false}
      onClose={() => {}}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Use camera for local placement" }));
  await screen.findByText("Camera View");
  const identity = JSON.parse(
    request.mock.calls.find(([m]) => JSON.parse(m).operation === "SPATIAL_START")![0],
  ).payload;
  for (let i = 0; i < 3; i++)
    fireEvent(
      window,
      new CustomEvent("landfall-native-event", {
        detail: { type: "parallax-tracking", state: "NORMAL", sessionId: identity.sessionId, epoch: identity.epoch },
      }),
    );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByText("Camera View")).toBeVisible();
  expect(request.mock.calls.some(([m]) => JSON.parse(m).operation === "SPATIAL_STOP")).toBe(false);
  fireEvent(window, new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "BACKGROUND" } }));
  await screen.findByText("Guided View");
  expect(request.mock.calls.some(([m]) => JSON.parse(m).operation === "SPATIAL_STOP")).toBe(true);
});

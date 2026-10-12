import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ChronicleLens, ChronicleLensEntry, ParallaxJournalProvider } from "./ChronicleLens";
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
  expect(screen.queryByRole("region", { name: "Voyage context" })).toBeNull();
  expect(screen.getByText(/The next bearing is written/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(record.mock.calls[0][0]).toMatchObject({ authority: "NONAUTHORITATIVE", mode: "GUIDED" });
  expect(screen.getByText(/You are inspecting/)).toBeVisible();
  fireEvent.click(screen.getByLabelText("Close Chronicle Lens"));
  expect(close).toHaveBeenCalled();
});
it("carries the authorized immutable Voyage context into the actual released Lens instead of its preview binding", async () => {
  const moment = syntheticSpatialMoment();
  const request = vi.fn(async () => Response.json({ moment, binding: syntheticBinding, replayOnly: false }));
  vi.stubGlobal("fetch", request);
  render(
    <ParallaxJournalProvider
      sessionId={syntheticBinding.sessionId}
      csrfToken="synthetic-csrf"
      voyageContext={{
        voyageId: syntheticBinding.sessionId,
        versionId: syntheticBinding.chronicleVersionId,
        title: "The Northern Light",
      }}
    >
      <ChronicleLensEntry moment={moment} blockId={syntheticBinding.blockId} replayOnly={false} />
    </ParallaxJournalProvider>,
  );
  expect(screen.queryByRole("region", { name: "Voyage context" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open Chronicle Lens" }));
  await screen.findByText("This device uses Guided View for this spatial moment.");
  const dialog = screen.getByRole("dialog", { name: "A message between worlds" });
  const context = within(dialog).getByRole("region", { name: "Voyage context" });
  expect(context).toHaveTextContent("Voyage");
  expect(context).toHaveTextContent("The Northern Light");
  expect(context).toHaveAttribute("data-experience-voyage", syntheticBinding.sessionId);
  expect(context).toHaveAttribute("data-experience-version", syntheticBinding.chronicleVersionId);
  expect(context.textContent).not.toContain(syntheticBinding.sessionId);
  expect(context.textContent).not.toContain(syntheticBinding.chronicleVersionId);
  expect(request).toHaveBeenCalledWith(
    `/api/player/playthroughs/${syntheticBinding.sessionId}/parallax?block=${syntheticBinding.blockId}`,
    { cache: "no-store" },
  );
});

it("omits another Voyage's private title when the Lens provider has a different authorized session", async () => {
  const moment = syntheticSpatialMoment();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ moment, binding: syntheticBinding, replayOnly: false })),
  );
  render(
    <ParallaxJournalProvider
      sessionId={syntheticBinding.sessionId}
      csrfToken="synthetic-csrf"
      voyageContext={{ voyageId: "another-voyage", versionId: "another-edition", title: "A private Chronicle" }}
    >
      <ChronicleLensEntry moment={moment} blockId={syntheticBinding.blockId} replayOnly={false} initiallyOpen />
    </ParallaxJournalProvider>,
  );
  await screen.findByText("This device uses Guided View for this spatial moment.");
  expect(screen.queryByRole("region", { name: "Voyage context" })).toBeNull();
  expect(screen.queryByText("A private Chronicle")).toBeNull();
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
it("opens and records Guided View when local HTTP lacks randomUUID", async () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const record = vi.fn().mockResolvedValue(undefined);
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
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(record.mock.calls[0][0].interactionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
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
  vi.unstubAllGlobals();
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

import { beforeEach, expect, it, vi } from "vitest";
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

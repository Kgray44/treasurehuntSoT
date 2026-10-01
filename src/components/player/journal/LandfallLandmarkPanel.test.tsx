import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandfallLandmarkPanel } from "@/components/player/journal/LandfallLandmarkPanel";

const props = {
  sessionId: "voyage",
  publishedVersionId: "edition",
  expectedSequence: 1,
  csrfToken: "synthetic-csrf",
  worldspaceId: "museum",
  waypointId: "mural",
  landmark: { id: "landmark", name: "Lantern mural", guidance: "Look for the mural.", minimumFrames: 2 },
  observations: [],
  eligible: true,
  historical: false,
  onVerified: vi.fn(async () => undefined),
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("foreground landmark camera consent and failure", () => {
  it("does not acquire a camera before regional eligibility or in replay", () => {
    const acquire = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: acquire } });
    const { rerender } = render(<LandfallLandmarkPanel {...props} eligible={false} />);
    expect(screen.getByRole("button", { name: "Open landmark camera" })).toBeDisabled();
    rerender(<LandfallLandmarkPanel {...props} historical />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(acquire).not.toHaveBeenCalled();
  });
  it("leaves a readable fallback after permission denial", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
      },
    });
    render(<LandfallLandmarkPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Open landmark camera" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("configured observation or Captain path"));
    expect(props.onVerified).not.toHaveBeenCalled();
  });
  it("stops tracks from a permission result that arrives after unmount", async () => {
    let complete!: (stream: MediaStream) => void;
    const acquire = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          complete = resolve;
        }),
    );
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: acquire } });
    const stop = vi.fn();
    const { unmount } = render(<LandfallLandmarkPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Open landmark camera" }));
    expect(acquire).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    unmount();
    complete({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });
});

// @sounding-line suite=unit.landfall contract=landfall.player-live-position
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandfallOfflineRegionPanel } from "./LandfallOfflineRegionPanel";
import {
  prepareLandfallRegion,
  downloadLandfallRegion,
  restoreLandfallRegion,
  removeLandfallRegionLease,
  type LandfallWebPackage,
} from "@/landfall/offline-package-web";
vi.mock("@/landfall/offline-package-web", () => ({
  prepareLandfallRegion: vi.fn(),
  restoreLandfallRegion: vi.fn(),
  downloadLandfallRegion: vi.fn(),
  extendLandfallRegionLease: vi.fn(async () => "TAB_ONLY"),
  removeLandfallRegionLease: vi.fn(),
}));
const props = {
  sessionId: "synthetic-voyage",
  publishedVersionId: "synthetic-pin",
  sequence: 2,
  csrfToken: "synthetic-csrf",
};
const remove = vi.fn();
const prepared = {
  descriptor: {
    envelope: {
      manifest: {
        id: "synthetic-region",
        scope: { publishedVersionId: props.publishedVersionId },
        totalBytes: 4096,
        issuedAt: Date.now() - 600000,
        revealedSequence: props.sequence,
        expiresAt: Date.now() + 60000,
        resources: [{ kind: "CHART" }, { kind: "ASSET" }],
      },
    },
    availability: { assets: "PARTIAL" },
  },
  repository: { status: vi.fn(async () => ({ state: "READY", downloadedBytes: 2048 })), remove },
  binding: {},
} as unknown as LandfallWebPackage;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(restoreLandfallRegion).mockResolvedValue(null);
  vi.mocked(prepareLandfallRegion).mockResolvedValue(prepared);
  vi.mocked(downloadLandfallRegion).mockResolvedValue("PARTIAL");
});
afterEach(cleanup);
it("shows size and contents before deliberate download and retains partial state with a history-safe removal explanation", async () => {
  render(<LandfallOfflineRegionPanel {...props} />);
  expect(prepareLandfallRegion).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Prepare offline region" }));
  await screen.findByRole("button", { name: "Download offline region" });
  expect(downloadLandfallRegion).not.toHaveBeenCalled();
  expect(screen.getByText(/Download size: 4 KB/)).toHaveTextContent("1 authorized first-party images");
  expect(screen.getByText(/preserves your saved Chronicle history/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Download offline region" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Offline region: partial"));
  expect(screen.getByRole("progressbar", { name: "Verified offline download" })).toHaveAttribute("value", "2048");
  fireEvent.click(screen.getByRole("button", { name: "Remove offline region" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("removed from this device"));
  expect(remove).toHaveBeenCalledOnce();
  expect(removeLandfallRegionLease).toHaveBeenCalledWith(props.sessionId);
});
it("a late preparation from a replaced Voyage cannot enable download or display its package", async () => {
  let resolve!: (value: LandfallWebPackage) => void;
  vi.mocked(prepareLandfallRegion).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = render(<LandfallOfflineRegionPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare offline region" }));
  view.rerender(<LandfallOfflineRegionPanel {...props} sessionId="replacement-voyage" />);
  resolve(prepared);
  await waitFor(() => expect(screen.getByRole("button", { name: "Prepare offline region" })).toBeEnabled());
  expect(screen.queryByRole("button", { name: "Download offline region" })).toBeNull();
  expect(screen.queryByText(/Download size:/)).toBeNull();
  expect(downloadLandfallRegion).not.toHaveBeenCalled();
});
it("reauthorizes an unexpired partial package at its original issue time across server time buckets", async () => {
  vi.mocked(restoreLandfallRegion).mockResolvedValue(prepared);
  prepared.repository.status = vi.fn(async () => ({
    state: "PARTIAL" as const,
    totalBytes: 4096,
    downloadedBytes: 2048,
    expiresAt: prepared.descriptor.envelope.manifest.expiresAt,
  }));
  render(<LandfallOfflineRegionPanel {...props} />);
  await screen.findByRole("button", { name: "Refresh or resume offline region" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh or resume offline region" }));
  await screen.findByRole("button", { name: "Download offline region" });
  expect(prepareLandfallRegion).toHaveBeenCalledWith(
    props.sessionId,
    props.csrfToken,
    prepared.descriptor.envelope.manifest.issuedAt,
  );
  expect(downloadLandfallRegion).not.toHaveBeenCalled();
});

import { generateKeyPairSync, webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandfallInstallationPanel } from "./LandfallInstallationPanel";
import { LandfallInstallationSigner } from "@/landfall/installation-token-server";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const fetcher = vi.fn(),
  pair = generateKeyPairSync("ed25519");
const definition = structuredClone(landfallFixture);
definition.waypoints[0].installations = [
  { id: "lab-installation", medium: "QR", label: "Synthetic tag", accessibilityAlternative: "Ask the Captain." },
];
const bootstrap = projectPlayerLandfallBootstrap(
  { sessionId: "lab-session", taleId: "fixture", publishedVersionId: "lab-pin", currentSequence: 4, definition },
  { releasedAssets: [], chapterId: null, blockId: null },
);
const scope = {
  taleId: "fixture",
  publishedVersionId: "lab-pin",
  worldspaceId: "town",
  waypointId: definition.waypoints[0].id,
};
const status = {
  state: "CONFIGURED",
  keyId: "lab-key",
  publicKey: pair.publicKey.export({ format: "jwk" }),
  scope,
  installations: definition.waypoints[0].installations,
  canComplete: false,
};
const token = () =>
  new LandfallInstallationSigner({ keyId: "lab-key", privateKey: pair.privateKey, publicKey: pair.publicKey }).issue({
    ...scope,
    id: "lab-installation",
    medium: "QR",
  }).token;
function mount() {
  const view = render(<LandfallInstallationPanel bootstrap={bootstrap} csrfToken="lab-csrf" />);
  view.container.querySelector("details")!.open = true;
  return view;
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  fetcher.mockResolvedValue({ ok: true, json: async () => status });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.LandfallNative;
});
describe("optional Player installation choices", () => {
  it("makes no automatic network, camera or location request and uses deliberate first-party availability", async () => {
    mount();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check installation availability" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Check signed text" })).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ operation: "STATUS" });
    expect(screen.getByRole("button", { name: "Scan optional QR" })).toBeDisabled();
  });
  it("offers offline-verifiable signed text without equating copies to presence or writing arrival", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Check installation availability" }));
    await screen.findByLabelText("Signed text alternative");
    fireEvent.change(screen.getByLabelText("Signed text alternative"), { target: { value: token() } });
    fireEvent.click(screen.getByRole("button", { name: "Check signed text" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Signed installation status" })).toHaveTextContent("verified locally"),
    );
    expect(screen.getByLabelText("Signed text alternative")).toHaveValue("");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(screen.getByRole("status", { name: "Signed installation status" })).toHaveTextContent(
      "Copies do not prove presence",
    );
  });
  it("clears text and trust on background, scope changes or details close without auto-resuming", async () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Check installation availability" }));
    await screen.findByLabelText("Signed text alternative");
    fireEvent.change(screen.getByLabelText("Signed text alternative"), { target: { value: "synthetic-input" } });
    act(() =>
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "BACKGROUND" } }),
      ),
    );
    expect(screen.queryByLabelText("Signed text alternative")).not.toBeInTheDocument();
    act(() =>
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "FOREGROUND" } }),
      ),
    );
    expect(fetcher).toHaveBeenCalledOnce();
    view.rerender(<LandfallInstallationPanel bootstrap={{ ...bootstrap, replayOnly: true }} csrfToken="lab-csrf" />);
    expect(screen.queryByText("Optional signed QR or NFC installation")).not.toBeInTheDocument();
  });
  it("keeps readable fallback when signing is absent and discards late revoked-scope availability", async () => {
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ state: "NOT_CONFIGURED", canComplete: false }) });
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Check installation availability" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Signed installation status" })).toHaveTextContent(
        "unavailable on this deployment",
      ),
    );
    let resolve!: (value: unknown) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check installation availability" }));
    view.rerender(<LandfallInstallationPanel bootstrap={{ ...bootstrap, currentSequence: 5 }} csrfToken="lab-csrf" />);
    await act(async () => resolve({ ok: true, json: async () => status }));
    expect(screen.queryByLabelText("Signed text alternative")).not.toBeInTheDocument();
  });
});

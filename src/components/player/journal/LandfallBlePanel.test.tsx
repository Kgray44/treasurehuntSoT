import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandfallBlePanel } from "./LandfallBlePanel";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "lab-session",
    taleId: "fixture",
    publishedVersionId: "lab-pin",
    currentSequence: 4,
    definition: landfallFixture,
  },
  { releasedAssets: [], chapterId: null, blockId: null },
);
let calls: { operation: string; payload: Record<string, unknown> }[];
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  calls = [];
});
afterEach(() => {
  cleanup();
  delete window.LandfallNative;
  vi.unstubAllGlobals();
});
it("keeps browser/manual fallback available without automatic radio requests and suppresses paused/history scans", () => {
  const view = render(<LandfallBlePanel bootstrap={bootstrap} />);
  expect(screen.getByRole("button", { name: "Scan optional Bluetooth" })).toBeDisabled();
  expect(calls).toEqual([]);
  view.rerender(<LandfallBlePanel bootstrap={{ ...bootstrap, paused: true }} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<LandfallBlePanel bootstrap={{ ...bootstrap, replayOnly: true }} />);
  expect(view.container).toBeEmptyDOMElement();
});
it("runs only on deliberate start, clears on scope/privacy changes and never shows private addresses", async () => {
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      calls.push(value);
      return { state: "GRANTED", accepted: true };
    }),
  };
  const view = render(<LandfallBlePanel bootstrap={bootstrap} />);
  view.container.querySelector("details")!.open = true;
  expect(calls).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Scan optional Bluetooth" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop Bluetooth scan" })).toBeEnabled());
  const scanId = calls.find((value) => value.operation === "BLE_START")!.payload.scanId;
  act(() => {
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", {
        detail: {
          type: "nearby",
          family: "BLE",
          protocol: "GENERIC",
          scanId,
          peerId: "a".repeat(64),
          observedAt: Date.now(),
          rssi: -50,
          authenticated: false,
        },
      }),
    );
  });
  expect(screen.getByRole("status")).toHaveTextContent("1 unverified device");
  expect(view.container).not.toHaveTextContent("a".repeat(64));
  act(() => {
    window.dispatchEvent(new Event("landfall-offline-cleared"));
  });
  expect(screen.getByRole("status")).toHaveTextContent("observations cleared");
  await waitFor(() => expect(calls.some((value) => value.operation === "BLE_STOP")).toBe(true));
  view.rerender(<LandfallBlePanel bootstrap={{ ...bootstrap, currentSequence: 5 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("scanning is off");
  expect(calls.filter((value) => value.operation === "BLE_START")).toHaveLength(1);
});

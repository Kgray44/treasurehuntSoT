import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const mocks = vi.hoisted(() => ({
  host: vi.fn(),
  prepare: vi.fn(),
  stop: vi.fn(),
  start: vi.fn(),
  lifecycle: null as null | ((state: "FOREGROUND" | "BACKGROUND") => void),
  power: null as null | ((state: { lowPower: boolean; thermalPressure: boolean; state: "READY" }) => void),
  fetch: vi.fn(),
}));
vi.mock("@/landfall/native-bridge", () => ({
  landfallNativeHost: mocks.host,
  subscribeLandfallNativeLifecycle: (listener: typeof mocks.lifecycle) => {
    mocks.lifecycle = listener;
    return () => {
      mocks.lifecycle = null;
    };
  },
  subscribeNativeLandfallPower: (listener: typeof mocks.power) => {
    mocks.power = listener;
    return () => {
      mocks.power = null;
    };
  },
}));
vi.mock("@/landfall/native-uwb", async (original) => {
  const actual = await original<typeof import("@/landfall/native-uwb")>();
  return {
    ...actual,
    NativeLandfallUwbProvider: class {
      prepare = mocks.prepare;
      stop = mocks.stop;
      start = mocks.start;
      snapshot() {
        return { state: "INITIALIZING", rangeAvailable: false, canComplete: false, peerVerified: false };
      }
    },
  };
});
import { LandfallNearbyPanel } from "./LandfallNearbyPanel";
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "session-1",
    publishedVersionId: "version-1",
    taleId: "fixture",
    currentSequence: 4,
    definition: landfallFixture,
  },
  { releasedAssets: [], chapterId: null, blockId: null },
);
const props = { bootstrap, csrfToken: "synthetic-csrf" };
const code = "a".repeat(43),
  handle = "b".repeat(43);
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const configured = { available: true, state: "CONFIGURED", peerVerified: false, canComplete: false };
let serverExpiresAt = 0;
const pending = () => ({
  available: true,
  state: "WAITING",
  code,
  handle,
  expiresAt: serverExpiresAt,
  remainingMs: 40000,
  peerVerified: false,
  canComplete: false,
});
const connected = () => {
  const expiresAt = serverExpiresAt;
  return {
    available: true,
    state: "READY",
    platform: "ANDROID",
    handle,
    expiresAt,
    remainingMs: 30000,
    peerVerified: false,
    canComplete: false,
    configuration: {
      peerId: "synthetic-peer",
      sessionId: 1,
      security: "PROVISIONED_STS",
      sessionKey: "AQEBAQEBAQEBAQEBAQEBAQ==",
      peerAddress: "AwQ=",
      channel: 9,
      preamble: 9,
      expiresAt,
    },
  };
};
beforeEach(() => {
  serverExpiresAt = Date.now() + 40000;
  vi.clearAllMocks();
  mocks.host.mockReturnValue({ platform: "ANDROID" });
  mocks.prepare.mockResolvedValue({ state: "READY", address: "AQI=", channel: 9, preamble: 9 });
  mocks.stop.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(undefined);
  mocks.fetch.mockImplementation(async (_url, init) => {
    const operation = JSON.parse(init.body).operation;
    return response(
      operation === "STATUS"
        ? configured
        : operation === "CREATE"
          ? pending()
          : operation === "STOP"
            ? { available: true, state: "STOPPED" }
            : connected(),
    );
  });
  vi.stubGlobal("fetch", mocks.fetch);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("optional companion consent and lifecycle", () => {
  it("makes no requests or radio preparations at mount, in replay, or without a native host", () => {
    const view = render(<LandfallNearbyPanel {...props} />);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    view.rerender(<LandfallNearbyPanel {...props} bootstrap={{ ...bootstrap, replayOnly: true }} />);
    expect(screen.queryByRole("button")).toBeNull();
    mocks.host.mockReturnValue(null);
    view.rerender(<LandfallNearbyPanel {...props} bootstrap={{ ...bootstrap, currentSequence: 5 }} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("checks first-party availability before requesting a contextual radio permission", async () => {
    mocks.fetch.mockResolvedValue(response({ available: false }, 503));
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Nearby device hint status" })).toHaveTextContent(
        "unavailable on this deployment",
      ),
    );
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("requires separate create and start actions and projects no raw range or completion", async () => {
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(screen.getByLabelText("Pairing code")).toHaveTextContent(code));
    expect(mocks.prepare).toHaveBeenCalledWith("CONTROLLER", true);
    expect(mocks.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start hints" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    act(() => mocks.start.mock.calls[0][1]({ state: "UNTRUSTED", rangeAvailable: true }));
    expect(screen.getByRole("status", { name: "Nearby device hint status" })).toHaveTextContent(
      "cannot confirm arrival",
    );
    expect(screen.queryByLabelText("Pairing code")).toBeNull();
    expect(mocks.fetch.mock.calls.every(([url]) => String(url).endsWith("/landfall/nearby"))).toBe(true);
  });
  it("shows the bounded code and starts a local native timer when the device clock trails the server", async () => {
    serverExpiresAt = Date.now() + 3_600_000;
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(screen.getByLabelText("Pairing code")).toHaveTextContent(code));
    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: "Start hints" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    const nativeExpiry = mocks.start.mock.calls[0][0].expiresAt;
    expect(nativeExpiry).toBeGreaterThan(before);
    expect(nativeExpiry).toBeLessThanOrEqual(Date.now() + 30000);
    expect(nativeExpiry).not.toBe(serverExpiresAt);
  });
  it("clears private pairing on background and does not resume radio acquisition automatically", async () => {
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(screen.getByLabelText("Pairing code")).toHaveTextContent(code));
    act(() => mocks.lifecycle?.("BACKGROUND"));
    await waitFor(() => expect(mocks.stop).toHaveBeenCalled());
    await waitFor(() =>
      expect(mocks.fetch.mock.calls.some(([, init]) => JSON.parse(init.body).operation === "STOP")).toBe(true),
    );
    act(() => mocks.lifecycle?.("FOREGROUND"));
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Pairing code")).toBeNull();
  });
  it("rejects stale first-party replies after the released objective changes", async () => {
    let resolve!: (value: unknown) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((complete) => {
          resolve = complete;
        }),
    );
    const view = render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<LandfallNearbyPanel {...props} bootstrap={{ ...bootstrap, currentSequence: 5 }} />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response(configured)));
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Nearby device hint status" })).toHaveTextContent("off");
  });
  it("joins as a controlee without inventing controller channel parameters", async () => {
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.change(screen.getByLabelText("Code from your other device"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Join my other device" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    expect(mocks.prepare).toHaveBeenCalledWith("CONTROLEE", true);
    const joined = mocks.fetch.mock.calls
      .map(([, init]) => JSON.parse(init.body))
      .find((body) => body.operation === "JOIN");
    expect(joined.offer).toEqual({ platform: "ANDROID", address: "AQI=" });
  });
  it("waits for the old native stop before preparing a replacement session", async () => {
    let release!: () => void;
    mocks.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(screen.getByLabelText("Pairing code")).toHaveTextContent(code));
    fireEvent.click(screen.getByRole("button", { name: "Stop nearby hints" }));
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status", { name: "Nearby device hint status" })).not.toHaveTextContent("stopped");
  });
  it("cancels pending first-party checks on Stop before any radio permission request", async () => {
    let release!: (value: unknown) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    render(<LandfallNearbyPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create pairing code" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "Stop nearby hints" }));
    expect(signal.aborted).toBe(true);
    await act(async () => release(response(configured)));
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Nearby device hint status" })).toHaveTextContent("stopped");
  });
});

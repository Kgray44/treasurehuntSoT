import { beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({
  request: vi.fn(),
  power: null as null | ((value: { lowPower: boolean; thermalPressure: boolean; state: string }) => void),
}));
vi.mock("./native-bridge", () => ({
  landfallNativeRequest: bridge.request,
  subscribeNativeLandfallPower: (listener: typeof bridge.power) => {
    bridge.power = listener;
    return () => {
      bridge.power = null;
    };
  },
}));
import { NativeContextProvider } from "./native-context";
const identity = { sessionId: "synthetic-session", publishedVersionId: "synthetic-version" };
describe("native optional sensor lifecycle", () => {
  beforeEach(() => {
    bridge.request.mockReset().mockResolvedValue({ accepted: true });
    bridge.power = null;
  });
  it("orders a stop after an outstanding native start before accepting another user start", async () => {
    let finish!: (value: unknown) => void;
    bridge.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const provider = new NativeContextProvider("synthetic-world");
    const state = vi.fn();
    const first = provider.start(identity, vi.fn(), state, true);
    await vi.waitFor(() => expect(bridge.request).toHaveBeenCalledWith("SENSORS_START"));
    provider.stop();
    const second = provider.start(identity, vi.fn(), state, true);
    finish({ accepted: true });
    await Promise.all([first, second]);
    expect(bridge.request.mock.calls.map(([operation]) => operation)).toEqual([
      "SENSORS_START",
      "SENSORS_STOP",
      "SENSORS_START",
    ]);
    expect(provider.active).toBe(true);
    expect(state).toHaveBeenCalledOnce();
    provider.stop();
  });
  it("pauses optional sensors on a power constraint and keeps them off until another deliberate action", async () => {
    const provider = new NativeContextProvider("synthetic-world");
    const state = vi.fn();
    await provider.start(identity, vi.fn(), state, true);
    expect(provider.active).toBe(true);
    bridge.power!({ lowPower: true, thermalPressure: false, state: "READY" });
    expect(provider.active).toBe(false);
    expect(state).toHaveBeenLastCalledWith("UNAVAILABLE");
    expect(bridge.power).toBeNull();
    await vi.waitFor(() => expect(bridge.request).toHaveBeenLastCalledWith("SENSORS_STOP"));
  });
});

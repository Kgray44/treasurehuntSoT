import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeContextProvider } from "@/landfall/native-context";
afterEach(() => {
  delete window.LandfallNative;
  vi.restoreAllMocks();
});
describe("native Player context bridge", () => {
  it("keeps sensor frames ephemeral and rejects stale callbacks after stop", async () => {
    const request = vi.fn(async (_raw: string) => ({ accepted: true }));
    window.LandfallNative = { version: 1, platform: "IOS", request };
    const provider = new NativeContextProvider("town");
    const emit = vi.fn();
    await provider.start({ sessionId: "session", publishedVersionId: "pin" }, emit, vi.fn(), true);
    const frame = { id: "heading", observedAt: Date.now(), kind: "HEADING", values: [30], accuracy: 10 };
    window.dispatchEvent(new CustomEvent("landfall-native-event", { detail: { type: "sensor", frame } }));
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session",
        publishedVersionId: "pin",
        worldspaceId: "town",
        kind: "HEADING",
        degrees: 30,
      }),
    );
    provider.stop();
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", {
        detail: { type: "sensor", frame: { ...frame, id: "late", observedAt: Date.now() + 300 } },
      }),
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(request.mock.calls.map(([raw]) => JSON.parse(raw).operation)).toEqual(["SENSORS_START", "SENSORS_STOP"]);
  });
  it("cannot become active from a permission reply delivered after teardown", async () => {
    let reply!: (value: unknown) => void;
    window.LandfallNative = {
      version: 1,
      platform: "ANDROID",
      request: async (raw) =>
        JSON.parse(raw).operation === "SENSORS_START"
          ? new Promise((resolve) => {
              reply = resolve;
            })
          : { accepted: true },
    };
    const provider = new NativeContextProvider("town");
    const state = vi.fn();
    const starting = provider.start({ sessionId: "session", publishedVersionId: "pin" }, vi.fn(), state, true);
    provider.stop();
    reply({ accepted: true });
    await starting;
    expect(provider.active).toBe(false);
    expect(state).not.toHaveBeenCalled();
  });
});

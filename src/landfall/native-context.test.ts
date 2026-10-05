import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeContextProvider } from "@/landfall/native-context";
afterEach(() => {
  delete window.LandfallNative;
  vi.restoreAllMocks();
});
describe("native Player context bridge", () => {
  it("keeps sensor frames ephemeral and rejects stale callbacks after stop", async () => {
    const request = vi.fn(async (raw: string) => ({
      accepted: ["SENSORS_START", "SENSORS_STOP"].includes(JSON.parse(raw).operation),
    }));
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
    await vi.waitFor(() =>
      expect(request.mock.calls.map(([raw]) => JSON.parse(raw).operation)).toEqual(["SENSORS_START", "SENSORS_STOP"]),
    );
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
    await vi.waitFor(() => expect(typeof reply).toBe("function"));
    provider.stop();
    reply({ accepted: true });
    await starting;
    expect(provider.active).toBe(false);
    expect(state).not.toHaveBeenCalled();
  });
  it("a conflicting native heading stops hints, clears their availability and ignores later callbacks until deliberate restart", async () => {
    const request = vi.fn(async (raw: string) => ({
      accepted: ["SENSORS_START", "SENSORS_STOP"].includes(JSON.parse(raw).operation),
    }));
    window.LandfallNative = { version: 1, platform: "ANDROID", request };
    const provider = new NativeContextProvider("town");
    const emit = vi.fn();
    const state = vi.fn();
    await provider.start({ sessionId: "session", publishedVersionId: "pin" }, emit, state, true);
    const now = Date.now();
    for (const [id, at, degrees] of [
      ["first", now, 0],
      ["conflict", now + 300, 180],
      ["late", now + 600, 30],
    ] as const)
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", {
          detail: { type: "sensor", frame: { id, observedAt: at, kind: "HEADING", values: [degrees], accuracy: 10 } },
        }),
      );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(state).toHaveBeenLastCalledWith("UNAVAILABLE");
    expect(provider.active).toBe(false);
    await vi.waitFor(() => expect(JSON.parse(request.mock.calls.at(-1)![0]).operation).toBe("SENSORS_STOP"));
  });
});

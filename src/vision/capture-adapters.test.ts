import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopCapturePlatformAdapter, WebCapturePlatformAdapter } from "@/vision/capture-adapters";
import type { WebCompanionClient } from "@/vision/web-companion-client";

const scanInput = {
  requestId: "request_adapter_test",
  attemptId: "attempt_adapter_test",
  durationMs: 5_000,
  sampleFps: 10,
  minimumFrames: 6,
};

afterEach(() => {
  delete window.tallTaleDesktop;
});

describe("capture platform adapter parity", () => {
  it("desktop adapter maps scan lifecycle to the restricted IPC command set", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === "capture.scan.start") return { sessionId: "scan_desktop_adapter", state: "CAPTURING" };
      if (command === "capture.scan.stop") return { sessionId: "scan_desktop_adapter", result: "EVIDENCE_CAPTURED" };
      return {};
    });
    window.tallTaleDesktop = {
      platform: "windows",
      shellVersion: "0.4.0-b2",
      invoke,
      subscribe: () => () => {},
    };
    const adapter = new DesktopCapturePlatformAdapter();
    const started = await adapter.beginPlayerScan(scanInput);
    expect(started).toEqual({ sessionId: "scan_desktop_adapter", state: "CAPTURING" });
    await adapter.stopPlayerScan(started.sessionId);
    expect(invoke).toHaveBeenNthCalledWith(1, "capture.scan.start", scanInput);
    expect(invoke).toHaveBeenNthCalledWith(2, "capture.scan.stop", { sessionId: started.sessionId });
  });

  it("browser adapter maps the same lifecycle to paired protocol commands", async () => {
    const command = vi.fn(async (name: string) => {
      if (name === "capture.scan.start") return { sessionId: "scan_browser_adapter", state: "CAPTURING" };
      if (name === "capture.scan.stop") return { sessionId: "scan_browser_adapter", result: "EVIDENCE_CAPTURED" };
      return {};
    });
    const client = {
      command,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as WebCompanionClient;
    const adapter = new WebCapturePlatformAdapter(client);
    const started = await adapter.beginPlayerScan(scanInput);
    expect(started).toEqual({ sessionId: "scan_browser_adapter", state: "CAPTURING" });
    await adapter.stopPlayerScan(started.sessionId);
    expect(command).toHaveBeenNthCalledWith(1, "capture.scan.start", scanInput);
    expect(command).toHaveBeenNthCalledWith(2, "capture.scan.stop", { sessionId: started.sessionId });
  });
});

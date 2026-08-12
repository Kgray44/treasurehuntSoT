import { afterEach, describe, expect, it, vi } from "vitest";

const prior = { ...process.env };
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key];
  Object.assign(process.env, prior);
});

describe("reporter helper", () => {
  it("uses a bearer credential but does not print it or the activity payload", async () => {
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fetchStub = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal("fetch", fetchStub);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T00:00:20.000Z"));
    process.env.BRIDGEWATCH_TELEMETRY_ENDPOINT = "http://127.0.0.1:4319/api/telemetry/heartbeat";
    process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "distinct-reporter-token";
    const originalArgv = process.argv;
    process.argv = ["node", "reporter.ts", "test/fixtures/heartbeat.json"];
    try {
      await import("../lib/reporter.js");
      expect(fetchStub).toHaveBeenCalledWith(
        process.env.BRIDGEWATCH_TELEMETRY_ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer distinct-reporter-token" }),
        }),
      );
      expect(output.mock.calls.flat().join("")).not.toContain("distinct-reporter-token");
      expect(output.mock.calls.flat().join("")).not.toContain("Wire durable telemetry");
    } finally {
      process.argv = originalArgv;
    }
  });
});

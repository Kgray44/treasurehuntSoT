import { describe, expect, it } from "vitest";
import { DeviceLabBleDiagnostics } from "./ble-diagnostics";

describe("bounded native BLE delivery diagnostics", () => {
  it("reports schema fields and freshness without retaining radio identities or values", () => {
    const diagnostic = new DeviceLabBleDiagnostics();
    const sample = {
      type: "nearby",
      family: "BLE",
      protocol: "GENERIC",
      authenticated: false,
      scanId: "00112233-4455-4677-8899-aabbccddeeff",
      peerId: "b".repeat(64),
      observedAt: 10000,
      rssi: -50,
    };
    diagnostic.observe(sample, 10000, false);
    diagnostic.observe({ ...sample, rssi: 127 }, 10000, false);
    diagnostic.observe({ ...sample, privateRadioAddress: "NEVER_RETAIN_THIS" }, 10000, false);
    diagnostic.observe(sample, 16000, true);
    diagnostic.observe(sample, 0, false);
    expect(diagnostic.snapshot()).toEqual({
      received: 5,
      validShape: 3,
      invalidShape: 2,
      stale: 1,
      future: 1,
      hidden: 1,
      invalidFields: ["UNRECOGNIZED_FIELD", "rssi"],
    });
    const encoded = JSON.stringify(diagnostic.snapshot());
    expect(encoded).not.toContain(sample.peerId);
    expect(encoded).not.toContain(sample.scanId);
    expect(encoded).not.toContain("NEVER_RETAIN_THIS");
    expect(encoded).not.toContain("127");
    const copy = diagnostic.snapshot();
    copy.invalidFields.length = 0;
    expect(diagnostic.snapshot().invalidFields).toHaveLength(2);
  });
});

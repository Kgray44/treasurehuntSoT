import { describe, expect, it } from "vitest";
import { DRYDOCK_FAULT_CATALOG, drydockFaultDefinition } from "@/drydock/simulation/faults";

describe("Drydock fault catalog", () => {
  it("defines an explicit safe outcome for every supported fault", () => {
    expect(DRYDOCK_FAULT_CATALOG).toHaveLength(15);
    for (const fault of DRYDOCK_FAULT_CATALOG) {
      expect(drydockFaultDefinition(fault.family, fault.code)).toEqual(fault);
      expect(fault.safeEventType).toMatch(/^[a-z][A-Za-z0-9]*$/u);
    }
  });

  it("fails closed for an unregistered family/code pair", () => {
    expect(drydockFaultDefinition("NETWORK", "EXFILTRATE")).toBeNull();
  });
});

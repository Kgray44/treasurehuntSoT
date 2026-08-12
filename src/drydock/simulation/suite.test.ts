import { describe, expect, it } from "vitest";
import { parseDrydockScenarioSuite } from "@/drydock/simulation/suite";

const suite = () => ({
  schemaVersion: 1,
  id: "suite-1",
  title: "Regression",
  sourceChecksum: "a".repeat(64),
  members: [{ scenarioId: "scenario-1", revision: 1 }],
});

describe("Drydock Scenario Suite schema", () => {
  it("accepts a bounded ordered set of immutable Scenario revisions", () => {
    expect(parseDrydockScenarioSuite(suite())).toMatchObject({
      id: "suite-1",
      members: [{ scenarioId: "scenario-1", revision: 1 }],
    });
  });

  it("rejects duplicate Scenario revisions", () => {
    expect(() =>
      parseDrydockScenarioSuite({
        ...suite(),
        members: [
          { scenarioId: "scenario-1", revision: 1 },
          { scenarioId: "scenario-1", revision: 1 },
        ],
      }),
    ).toThrow(/appear once/u);
  });
});

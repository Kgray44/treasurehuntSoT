import { describe, expect, it } from "vitest";
import { simulateLandfallObservation } from "@/drydock/landfall-adapter";
import { landfallFixture, physicalObservation, virtualObservation } from "@/landfall/fixtures";

const at = (seconds: number) => new Date(Date.UTC(2026, 8, 29, 12, 0, seconds)).toISOString();
const now = (seconds: number) => Date.parse(at(seconds));
const base = { definition: landfallFixture, sessionId: "session-1", publishedVersionId: "version-1" };

describe("Drydock Landfall deterministic provider seam", () => {
  it.each([
    {
      name: "physical arrival",
      worldspaceId: "town",
      waypointId: "town-arrival",
      observations: [physicalObservation("a", at(1)), physicalObservation("b", at(2))],
      clocks: [now(1), now(2)],
      expected: "MATCH",
    },
    {
      name: "physical outside",
      worldspaceId: "town",
      waypointId: "town-arrival",
      observations: [physicalObservation("a", at(1), 44.02, -72)],
      clocks: [now(1)],
      expected: "NO_MATCH",
    },
    {
      name: "poor physical accuracy",
      worldspaceId: "town",
      waypointId: "town-arrival",
      observations: [physicalObservation("a", at(1), 44, -72, 500)],
      clocks: [now(1)],
      expected: "UNCERTAIN",
    },
    {
      name: "stale physical evidence",
      worldspaceId: "town",
      waypointId: "town-arrival",
      observations: [physicalObservation("a", at(1))],
      clocks: [now(100)],
      expected: "UNCERTAIN",
    },
    {
      name: "virtual confirmation",
      worldspaceId: "isles",
      waypointId: "isle-region",
      observations: [virtualObservation("a", at(1))],
      clocks: [now(1)],
      expected: "MATCH",
    },
    {
      name: "virtual wrong place",
      worldspaceId: "isles",
      waypointId: "isle-region",
      observations: [virtualObservation("a", at(1), "other")],
      clocks: [now(1)],
      expected: "NO_MATCH",
    },
    {
      name: "virtual uncertainty",
      worldspaceId: "isles",
      waypointId: "isle-region",
      observations: [virtualObservation("a", at(1), "isle-region", "UNCERTAIN")],
      clocks: [now(1)],
      expected: "UNCERTAIN",
    },
  ])("maps $name to $expected", ({ worldspaceId, waypointId, observations, clocks, expected }) => {
    expect(simulateLandfallObservation({ ...base, worldspaceId, waypointId, observations, now: clocks }).outcome).toBe(
      expected,
    );
  });
});

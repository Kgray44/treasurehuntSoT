import { describe, expect, it } from "vitest";
import { observationContextReached } from "@/landfall/observation-context";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import type { PublishedBlock } from "@/chronicle/types";

const block = {
  id: "observation",
  chapterId: "chapter",
  blockType: "locationObservation",
  title: "Look at the marker",
  configuration: {
    heading: "Reach the square",
    prompt: "Observe the carved bird",
    worldspaceId: "town",
    waypointId: "square",
  },
  completion: {},
  presentation: {},
  orderIndex: 0,
  connections: [],
  isEnabled: true,
  nextBlockId: null,
} as PublishedBlock;
const arrival = {
  id: "arrival",
  blockId: "observation",
  sequence: 2,
  eventType: "landfallWaypointConfirmed",
  payload: { worldspaceId: "town", waypointId: "square", outcome: "CONFIRMED", method: "BROWSER_GEOLOCATION" },
};

describe("locationObservation canonical prerequisite", () => {
  it("withholds the prompt and response state until a canonical arrival for this Passage", () => {
    expect(observationContextReached(block, [])).toBe(false);
    expect(projectPlayerBlock(block)?.configuration).not.toHaveProperty("prompt");
    expect(projectPlayerBlock(block)?.locationContextReached).toBe(false);
    expect(
      projectPlayerBlock(block, { locationContextReached: observationContextReached(block, [arrival]) }),
    ).toMatchObject({ locationContextReached: true, configuration: { prompt: "Observe the carved bird" } });
  });
  it.each(["PLAYER_CONFIRMATION", "CAPTAIN_CONFIRMATION", "BROWSER_GEOLOCATION"])(
    "retains governed %s arrival provenance",
    (method) => {
      expect(observationContextReached(block, [{ ...arrival, payload: { ...arrival.payload, method } }])).toBe(true);
    },
  );
  it.each([
    { ...arrival, blockId: "other-passage" },
    { ...arrival, eventType: "landfallWaypointSkipped" },
    { ...arrival, payload: { ...arrival.payload, worldspaceId: "isles" } },
    { ...arrival, payload: { ...arrival.payload, waypointId: "other-location" } },
    { ...arrival, payload: { ...arrival.payload, outcome: "LIKELY_INSIDE" } },
    { ...arrival, payload: "malformed" },
  ])("rejects unrelated, insufficient or malformed canonical context %#", (event) => {
    expect(observationContextReached(block, [event])).toBe(false);
  });
  it("duplicate arrival remains a prerequisite, never an observation response", () => {
    expect(observationContextReached(block, [arrival, arrival])).toBe(true);
    expect(arrival.eventType).toBe("landfallWaypointConfirmed");
    expect(arrival.payload).not.toHaveProperty("response");
  });
});

import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const snapshot = (publishedAt: string): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: {
    id: "tale",
    slug: "tale",
    title: "Tale",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "NAUTICAL",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt,
});

describe("Drydock simulation source identity", () => {
  it("does not treat Studio's projection timestamp as authored source", () => {
    expect(drydockSimulationSourceChecksum(snapshot("2026-08-12T00:00:00.000Z"))).toBe(
      drydockSimulationSourceChecksum(snapshot("2026-08-12T00:00:01.000Z")),
    );
  });
});

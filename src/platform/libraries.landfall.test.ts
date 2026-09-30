import { describe, expect, it } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { validateLandfallDefinition } from "@/landfall/definition";
import { playerSafeAssetIds } from "@/platform/libraries";

const snapshot = JSON.stringify({
  schemaVersion: 1,
  tale: { coverAssetId: null },
  chapters: [],
  assets: [{ id: "synthetic-chart" }],
  landfall: landfallFixture,
});

describe("Landfall map asset authorization", () => {
  it("releases only the map asset in the canonical active Worldspace", () => {
    const before = playerSafeAssetIds(snapshot, [], "[]", { events: [], chapterId: null, blockId: null });
    expect(before.has("synthetic-chart")).toBe(false);
    const after = playerSafeAssetIds(snapshot, [], "[]", {
      events: [
        { id: "entered", sequence: 1, eventType: "landfallWorldspaceEntered", payload: { worldspaceId: "isles" } },
      ],
      chapterId: "chapter-isles",
      blockId: null,
    });
    expect(after.has("synthetic-chart")).toBe(true);
  });

  it("withholds a hidden map overlay until the canonical reveal event", () => {
    const definition = validateLandfallDefinition({
      ...landfallFixture,
      maps: landfallFixture.maps.map((map) =>
        map.id === "town-map"
          ? {
              ...map,
              overlays: [
                {
                  id: "secret-overlay",
                  assetId: "secret-image",
                  hiddenUntilRevealed: true,
                  opacity: 0.8,
                  bounds: { west: -72.1, south: 43.9, east: -71.9, north: 44.1 },
                  attributionLabel: "Fixture art",
                  attributionUrl: "https://example.invalid/credit",
                  privacyClassification: "APPROXIMATE_REAL_WORLD",
                },
              ],
            }
          : map,
      ),
    });
    const content = JSON.stringify({
      schemaVersion: 1,
      tale: { coverAssetId: null },
      chapters: [],
      assets: [],
      landfall: definition,
    });
    expect(
      playerSafeAssetIds(content, [], "[]", { events: [], chapterId: null, blockId: null }).has("secret-image"),
    ).toBe(false);
    expect(
      playerSafeAssetIds(content, [], "[]", {
        events: [
          {
            id: "overlay-reveal",
            sequence: 1,
            eventType: "landfallOverlayRevealed",
            payload: { overlayId: "secret-overlay" },
          },
        ],
        chapterId: null,
        blockId: null,
      }).has("secret-image"),
    ).toBe(true);
  });
});

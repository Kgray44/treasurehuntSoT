// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { landfallFixture } from "@/landfall/fixtures";
vi.mock("@/landfall/player-bootstrap", () => ({
  projectPlayerLandfallBootstrap: () => ({
    scene: { mapId: "chart", worldspaceId: "town", features: [{ id: "place" }] },
    availableMaps: [
      {
        id: "other-chart",
        scene: { mapId: "other-chart", worldspaceId: "isles", features: [{ id: "other-place" }] },
      },
    ],
    runtimeDefinition: { routes: [] },
  }),
}));
import { resolveCrossdeckObject } from "./objects";
const snapshot = {
  schemaVersion: 1,
  tale: { id: "tale", title: "Synthetic", slug: "synthetic" },
  assets: [],
  chapters: [
    {
      id: "chapter",
      blocks: [
        {
          id: "map",
          chapterId: "chapter",
          blockType: "livingChart",
          title: "Released chart",
          configuration: {},
          connections: [],
        },
      ],
    },
  ],
  landfall: landfallFixture,
};
const tx = {
  taleSession: {
    findUniqueOrThrow: async () => ({
      taleId: "tale",
      currentBlockId: "map",
      currentSequence: 1,
      draftRevisionId: null,
      previewSnapshot: JSON.stringify(snapshot),
      revealStates: [],
    }),
  },
  taleSessionEvent: { findMany: async () => [] },
} as unknown as Prisma.TransactionClient;
const actor = { accountId: "account", id: "session" },
  ref = { family: "MAP" as const, objectId: "map", version: "draft:unknown" };
describe("Crossdeck continuity constrained by Landfall's released projection", () => {
  it("preserves only the selected released chart's worldspace and marker", async () => {
    const result = await resolveCrossdeckObject(tx, actor, "voyage", ref, {
      mapId: "chart",
      worldspaceId: "town",
      selectedMarkerId: "place",
    });
    expect(result.scene?.mapId).toBe("chart");
    await expect(
      resolveCrossdeckObject(tx, actor, "voyage", ref, { mapId: "chart", worldspaceId: "isles" }),
    ).rejects.toThrow(/Refresh/);
    await expect(
      resolveCrossdeckObject(tx, actor, "voyage", ref, { mapId: "chart", selectedMarkerId: "other-place" }),
    ).rejects.toThrow(/Choose a place/);
  });
  it("refuses unreleased markers and private annotation drafts", async () => {
    await expect(
      resolveCrossdeckObject(tx, actor, "voyage", ref, { mapId: "chart", selectedMarkerId: "hidden" }),
    ).rejects.toThrow(/Refresh/);
    await expect(
      resolveCrossdeckObject(tx, actor, "voyage", ref, { mapId: "chart", annotationContextId: "draft" }),
    ).rejects.toThrow(/originating/);
  });
});

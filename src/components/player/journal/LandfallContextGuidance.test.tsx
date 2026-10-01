import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { LandfallContextGuidance } from "./LandfallContextGuidance";

it("selects a viewing floor independently from contextual likely-floor evidence", () => {
  const definition = structuredClone(landfallFixture);
  definition.context = {
    regions: [
      {
        id: "floor-one",
        worldspaceId: "town",
        mapId: definition.maps[0].id,
        name: "First floor",
        kind: "FLOOR",
        level: "1",
        geometry: definition.waypoints[0].geometry,
        privacyClassification: "PUBLIC_REAL_WORLD",
        hiddenUntilRevealed: false,
      },
    ],
    landmarks: [],
  };
  definition.maps.push({
    ...definition.maps[0],
    id: "floor-two",
    name: "Second floor",
    level: "2",
    source: { type: "AUTHORED_VECTOR" },
  });
  const bootstrap = projectPlayerLandfallBootstrap(
    { sessionId: "synthetic", taleId: "fixture", publishedVersionId: "edition", currentSequence: 1, definition },
    { blockId: null, chapterId: null, releasedAssets: [] },
  );
  const change = vi.fn();
  render(
    <LandfallContextGuidance
      bootstrap={bootstrap}
      viewingMapId="floor-two"
      onViewingMapChange={change}
      snapshot={{
        state: "LIKELY",
        regionId: "floor-one",
        mapId: definition.maps[0].id,
        level: "1",
        evidenceCategories: ["POSITION"],
      }}
    />,
  );
  expect(screen.getByText(/likely level 1/)).toBeTruthy();
  expect(screen.getByText(/Viewing level 2/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: definition.maps[0].id } });
  expect(change).toHaveBeenCalledWith(definition.maps[0].id);
  expect(screen.getByText(/likely level 1/)).toBeTruthy();
});

it("adds no contextual controls to a legacy chart", () => {
  const bootstrap = projectPlayerLandfallBootstrap(
    {
      sessionId: "synthetic",
      taleId: "fixture",
      publishedVersionId: "edition",
      currentSequence: 1,
      definition: landfallFixture,
    },
    { blockId: null, chapterId: null, releasedAssets: [] },
  );
  const view = render(
    <LandfallContextGuidance
      bootstrap={bootstrap}
      viewingMapId={bootstrap.scene.mapId}
      onViewingMapChange={() => undefined}
      snapshot={null}
    />,
  );
  expect(view.container.textContent).toBe("");
});

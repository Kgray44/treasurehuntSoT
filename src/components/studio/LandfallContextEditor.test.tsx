import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandfallContextEditor } from "@/components/studio/LandfallContextEditor";
import { createLandfallWorldspace, createLandfallWaypoint } from "@/landfall/authoring";
import { validateLandfallDefinition } from "@/landfall/definition";
import type { Asset } from "@/components/studio/studio-types";
import type { LandfallDefinition } from "@/landfall/schema";

afterEach(cleanup);
const image = (id: string): Asset => ({
  id,
  displayName: id,
  description: null,
  mediaType: "IMAGE",
  mimeType: "image/png",
  width: 100,
  height: 100,
  tags: [],
  roles: [],
  collectionItems: [],
  createdAt: "",
  updatedAt: "",
  variants: [{ role: "ORIGINAL", url: `/protected/${id}`, processingState: "READY" }],
});
const assets = [image("synthetic-positive"), image("synthetic-negative")];
function fixture(): LandfallDefinition {
  const base = createLandfallWorldspace({ taleId: "synthetic-tale", name: "Synthetic museum", kind: "PHYSICAL" });
  const waypoint = createLandfallWaypoint(
    base.worldspaces[0],
    base.maps[0],
    base.maps[0].camera.center,
    "Synthetic exhibit",
  );
  return validateLandfallDefinition({
    ...base,
    maps: [
      {
        ...base.maps[0],
        overlays: [
          {
            id: "synthetic-overlay",
            assetId: "synthetic-positive",
            bounds: { west: -0.001, east: 0.001, south: -0.001, north: 0.001 },
            opacity: 0.8,
            attributionLabel: "Synthetic floor",
            attributionUrl: "https://example.invalid/synthetic",
            hiddenUntilRevealed: false,
            privacyClassification: "APPROXIMATE_REAL_WORLD",
          },
        ],
      },
    ],
    waypoints: [{ ...waypoint, regionId: "synthetic-region" }],
    context: {
      regions: [
        {
          id: "synthetic-region",
          mapId: base.maps[0].id,
          worldspaceId: base.worldspaces[0].id,
          name: "Synthetic gallery",
          kind: "GALLERY",
          level: "Ground",
          geometry: waypoint.geometry,
          hiddenUntilRevealed: false,
          privacyClassification: "APPROXIMATE_REAL_WORLD",
        },
      ],
      landmarks: [],
    },
  });
}
function Harness({
  saved,
  draw = vi.fn(),
  selectMap = vi.fn(),
}: {
  saved: (definition: LandfallDefinition) => void;
  draw?: (id: string, shape: "POLYGON" | "CORRIDOR" | "GATE") => void;
  selectMap?: (id: string) => void;
}) {
  const [definition, setDefinition] = useState(fixture);
  const [region, setRegion] = useState<string | null>("synthetic-region");
  return (
    <LandfallContextEditor
      definition={definition}
      worldspace={definition.worldspaces[0]}
      map={definition.maps[0]}
      assets={assets}
      waypoint={definition.waypoints[0]}
      selectedRegionId={region}
      onSelectRegion={setRegion}
      onDrawRegion={draw}
      onSelectMap={selectMap}
      onChange={(next) => {
        const parsed = validateLandfallDefinition(next);
        setDefinition(parsed);
        saved(parsed);
        return true;
      }}
    />
  );
}
describe("Creator contextual authoring", () => {
  it("enables declared vision evidence and keeps landmark and waypoint fallback canonical", () => {
    const saved = vi.fn();
    render(<Harness saved={saved} />);
    fireEvent.change(screen.getByLabelText("First positive reference"), { target: { value: "synthetic-positive" } });
    fireEvent.click(screen.getByRole("button", { name: "Add natural landmark" }));
    const created = saved.mock.calls.at(-1)?.[0] as LandfallDefinition;
    expect(created.waypoints[0].evidenceProfile.acceptedSources).toContain("VISION_WAYPOINT");
    expect(created.worldspaces[0].observationPolicy.allowedSources).toContain("VISION_WAYPOINT");
    fireEvent.change(screen.getByLabelText("Landmark fallback"), { target: { value: "CAPTAIN" } });
    const updated = saved.mock.calls.at(-1)?.[0] as LandfallDefinition;
    expect(updated.waypoints[0].fallback).toEqual({ mode: "CAPTAIN" });
    expect(updated.context?.landmarks[0].fallback).toEqual(updated.waypoints[0].fallback);
  });
  it("adds a native floor chart with a label and preserved overlay alignment", () => {
    const saved = vi.fn(),
      selectMap = vi.fn();
    render(<Harness saved={saved} selectMap={selectMap} />);
    fireEvent.change(screen.getByLabelText("Floor label"), { target: { value: "Upper floor" } });
    fireEvent.click(screen.getByRole("button", { name: "Add floor chart" }));
    const next = saved.mock.calls[0][0] as LandfallDefinition;
    expect(next.maps[1]).toMatchObject({ role: "FLOOR", level: "Upper floor", camera: next.maps[0].camera });
    expect(next.maps[1].overlays?.[0].bounds).toEqual(next.maps[0].overlays?.[0].bounds);
    expect(next.maps[1].overlays?.[0].id).not.toBe(next.maps[0].overlays?.[0].id);
    expect(next.worldspaces[0].mapDefinitionIds).toContain(next.maps[1].id);
    expect(selectMap).toHaveBeenCalledWith(next.maps[1].id);
  });
  it("uses the chart drawing tools and protected positive/negative asset selection", () => {
    const saved = vi.fn(),
      draw = vi.fn();
    render(<Harness saved={saved} draw={draw} />);
    fireEvent.click(screen.getByRole("button", { name: "Draw region corridor" }));
    expect(draw).toHaveBeenCalledWith("synthetic-region", "CORRIDOR");
    fireEvent.change(screen.getByLabelText("First positive reference"), { target: { value: "synthetic-positive" } });
    fireEvent.click(screen.getByRole("button", { name: "Add natural landmark" }));
    const negatives = screen.getByRole("group", { name: "Similar things to exclude (up to 8)" });
    expect(within(negatives).getByLabelText("synthetic-positive")).toBeDisabled();
    fireEvent.click(within(negatives).getByLabelText("synthetic-negative"));
    fireEvent.change(screen.getByLabelText("Consistent frames needed"), { target: { value: "4" } });
    const next = saved.mock.calls.at(-1)?.[0] as LandfallDefinition;
    expect(next.context?.landmarks[0]).toMatchObject({
      regionId: "synthetic-region",
      referenceAssetIds: ["synthetic-positive"],
      negativeReferenceAssetIds: ["synthetic-negative"],
      minimumFrames: 4,
      fallback: { mode: "PLAYER" },
    });
    expect(next.waypoints[0].landmarkId).toBe(next.context?.landmarks[0].id);
    expect(JSON.stringify(next.context)).not.toContain("/protected/");
    fireEvent.click(screen.getByRole("button", { name: "Remove region and its landmark associations" }));
    const removed = saved.mock.calls.at(-1)?.[0] as LandfallDefinition;
    expect(removed.context).toEqual({ regions: [], landmarks: [] });
    expect(removed.waypoints[0].regionId).toBeUndefined();
    expect(removed.waypoints[0].landmarkId).toBeUndefined();
  });
});

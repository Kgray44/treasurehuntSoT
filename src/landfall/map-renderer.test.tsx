import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectLandfallMap } from "@/landfall/map-projection";
import { LandfallMapRenderer } from "@/landfall/map-renderer";

const mapConstructed = vi.hoisted(() => vi.fn());
vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      mapConstructed(options);
    }
    on() {}
    remove() {}
  },
}));

describe("Landfall internal map presentation proof", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());
  it("renders an image-backed virtual map with only revealed locations and an accessible list", () => {
    const hidden = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [],
      activeRouteId: null,
    });
    const { rerender } = render(<LandfallMapRenderer scene={hidden} />);
    expect(screen.getByRole("img", { name: "Virtual Landfall chart" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Visible map locations" })).toBeEmptyDOMElement();
    const revealed = { ...projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [{ id: "isle-region" }],
      activeRouteId: null,
    }), imageUrl: "/api/media/synthetic-chart?version=version-1&session=session-1" };
    rerender(<LandfallMapRenderer scene={revealed} />);
    expect(screen.getByText("Secret Isle")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Virtual Landfall chart" }).querySelector("image")?.getAttribute("href"),
    ).toBe("/api/media/synthetic-chart?version=version-1&session=session-1");
  });
  it("mounts the physical MapLibre adapter with canonical GeoJSON overlays", async () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: "town-route",
    });
    render(<LandfallMapRenderer scene={scene} />);
    await waitFor(() => expect(mapConstructed).toHaveBeenCalled());
    const options = mapConstructed.mock.calls.at(-1)?.[0] as {
      style: { sources: { landfall: { data: { features: { properties: { id: string } }[] } } } };
    };
    expect(options.style.sources.landfall.data.features.map((feature) => feature.properties.id)).toEqual([
      "town-arrival",
      "town-route",
    ]);
    expect(screen.getByLabelText("Physical Landfall map")).toBeInTheDocument();
  });
  it("falls back to a location list when a trusted provider returns unsafe configuration", async () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: null,
    });
    render(
      <LandfallMapRenderer
        scene={scene}
        provider={{
          id: "bad",
          style: async () =>
            ({ version: 8, sources: { bad: { type: "vector", tiles: ["javascript:alert(1)"] } }, layers: [] }) as never,
        }}
      />,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Map data is unavailable"));
    expect(screen.getByRole("list", { name: "Visible map locations" })).toHaveTextContent("Town arrival");
    expect(mapConstructed).not.toHaveBeenCalled();
  });
});

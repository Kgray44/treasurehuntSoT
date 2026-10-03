import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectLandfallMap } from "@/landfall/map-projection";
import { LandfallMapRenderer } from "@/landfall/map-renderer";
import { selectReleasedChartPlace } from "@/landfall/chart-search";

const mapConstructed = vi.hoisted(() => vi.fn());
const mapState = vi.hoisted(() => ({ setData: vi.fn(), jumpTo: vi.fn(), load: undefined as (() => void) | undefined }));
vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      mapConstructed(options);
    }
    on(event: string, callback: unknown) {
      if (event === "load" && typeof callback === "function") mapState.load = callback as () => void;
    }
    getSource() {
      return { setData: mapState.setData };
    }
    isStyleLoaded() {
      return false;
    }
    jumpTo(options: unknown) {
      mapState.jumpTo(options);
    }
    remove() {}
  },
}));

describe("Landfall internal map presentation proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapState.load = undefined;
  });
  afterEach(() => cleanup());
  it("does not call an injected third-party style provider before consent", async () => {
    const style = vi.fn().mockResolvedValue({ version: 8, sources: {}, layers: [] });
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: null,
    });
    render(<LandfallMapRenderer scene={scene} provider={{ id: "remote-style", style }} />);
    await waitFor(() => expect(mapConstructed).toHaveBeenCalled());
    expect(style).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load online background maps" }));
    await waitFor(() => expect(style).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Stop loading online background maps" }));
    await waitFor(() => expect(mapConstructed.mock.calls.at(-1)?.[0].style.sources.landfall).toBeDefined());
    expect(style).toHaveBeenCalledTimes(1);
  });
  it("never requests raster tiles before deliberate consent and stops them when consent is revoked", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        state: "CONFIGURED",
        id: "deployment-raster",
        tileTemplate: "https://maps.example.org/{z}/{x}/{y}.png",
        attributionLabel: "Synthetic map license",
        attributionUrl: "https://maps.example.org/license",
        maxZoom: 18,
        offlineRights: "PROHIBITED",
      }),
    });
    vi.stubGlobal("fetch", request);
    try {
      const scene = {
        ...projectLandfallMap(landfallFixture, {
          activeWorldspaceId: "town",
          availableLocations: [{ id: "town-arrival" }],
          activeRouteId: null,
        }),
        baseProviderId: "osm-standard",
      };
      const view = render(<LandfallMapRenderer scene={scene} />);
      await screen.findByRole("button", { name: "Load online background maps" });
      await waitFor(() => expect(mapConstructed).toHaveBeenCalled());
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0][0]).toBe("/api/landfall/map-data");
      for (const [options] of mapConstructed.mock.calls)
        expect(JSON.stringify(options.style.sources)).not.toContain("maps.example.org");
      fireEvent.click(screen.getByRole("button", { name: "Load online background maps" }));
      await waitFor(() =>
        expect(mapConstructed.mock.calls.at(-1)?.[0].style.sources["deployment-raster"].tiles).toEqual([
          "https://maps.example.org/{z}/{x}/{y}.png",
        ]),
      );
      fireEvent.click(screen.getByRole("button", { name: "Stop loading online background maps" }));
      await waitFor(() =>
        expect(mapConstructed.mock.calls.at(-1)?.[0].style.sources["deployment-raster"]).toBeUndefined(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Load online background maps" }));
      await waitFor(() =>
        expect(mapConstructed.mock.calls.at(-1)?.[0].style.sources["deployment-raster"]).toBeDefined(),
      );
      const previousConstructions = mapConstructed.mock.calls.length;
      view.rerender(<LandfallMapRenderer scene={{ ...scene, mapId: "another-released-map" }} />);
      await waitFor(() => expect(mapConstructed.mock.calls.length).toBeGreaterThan(previousConstructions));
      for (const [options] of mapConstructed.mock.calls.slice(previousConstructions))
        expect(options.style.sources["deployment-raster"]).toBeUndefined();
      expect(screen.getByRole("list", { name: "Visible map locations" })).toHaveTextContent("Town arrival");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("renders an image-backed virtual map with only revealed locations and an accessible list", () => {
    const hidden = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [],
      activeRouteId: null,
    });
    const { rerender } = render(<LandfallMapRenderer scene={hidden} />);
    expect(screen.getByRole("img", { name: "Virtual Landfall chart" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Visible map locations" })).toBeEmptyDOMElement();
    const revealed = {
      ...projectLandfallMap(landfallFixture, {
        activeWorldspaceId: "isles",
        availableLocations: [{ id: "isle-region" }],
        activeRouteId: null,
      }),
      imageUrl: "/api/media/synthetic-chart?version=version-1&session=session-1",
    };
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
    fireEvent.click(screen.getByRole("button", { name: "Load online background maps" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Map data is unavailable"));
    expect(screen.getByRole("list", { name: "Visible map locations" })).toHaveTextContent("Town arrival");
    expect(
      screen
        .getByRole("img", { name: "Released physical chart" })
        .querySelector('[data-landfall-feature="town-arrival"]'),
    ).not.toBeNull();
    expect(mapConstructed.mock.calls.every(([options]) => !options.style.sources.bad)).toBe(true);
  });
  it("preserves a deliberate selection when MapLibre finishes loading after a search", async () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: null,
    });
    const view = render(<LandfallMapRenderer scene={scene} />);
    await waitFor(() => expect(mapState.load).toBeDefined());
    view.rerender(<LandfallMapRenderer scene={selectReleasedChartPlace(scene, "town-arrival")} />);
    mapState.setData.mockClear();
    mapState.load?.();
    expect(mapState.setData.mock.calls[0][0].features[0].properties).toMatchObject({
      id: "town-arrival",
      selected: true,
    });
    expect(screen.getByRole("list", { name: "Visible map locations" })).toHaveTextContent(
      "Town arrival · selected for viewing",
    );
  });
  it("highlights a released virtual region without adding a position marker", () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [{ id: "isle-region" }],
      activeRouteId: null,
    });
    render(<LandfallMapRenderer scene={selectReleasedChartPlace(scene, "isle-region")} />);
    const chart = screen.getByRole("img", { name: "Virtual Landfall chart" });
    expect(chart.querySelector('[data-landfall-feature="isle-region"]')).toHaveAttribute("fill-opacity", "0.45");
    expect(chart.querySelector("circle")).toBeNull();
    expect(screen.getByRole("list", { name: "Visible map locations" })).toHaveTextContent(
      "Secret Isle · selected for viewing",
    );
  });
});

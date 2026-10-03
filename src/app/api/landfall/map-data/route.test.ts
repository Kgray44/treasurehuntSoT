import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("public Landfall map configuration endpoint", () => {
  it("returns only allowlisted public metadata without contacting a provider", async () => {
    vi.stubEnv("LANDFALL_RASTER_TILE_TEMPLATE", "https://maps.example.org/{z}/{x}/{y}.png");
    vi.stubEnv("LANDFALL_RASTER_ATTRIBUTION_LABEL", "Synthetic contributors");
    vi.stubEnv("LANDFALL_RASTER_ATTRIBUTION_URL", "https://maps.example.org/license");
    vi.stubEnv("LANDFALL_RASTER_MAX_ZOOM", "17");
    vi.stubEnv("LANDFALL_PROVIDER_SECRET", "SYNTHETIC_NEVER_PUBLIC");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const response = GET();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({
      state: "CONFIGURED",
      id: "deployment-raster",
      tileTemplate: "https://maps.example.org/{z}/{x}/{y}.png",
      attributionLabel: "Synthetic contributors",
      attributionUrl: "https://maps.example.org/license",
      maxZoom: 17,
      offlineRights: "PROHIBITED",
    });
    expect(network).not.toHaveBeenCalled();
  });
  it("does not echo a misconfigured credential-bearing URL", async () => {
    vi.stubEnv("LANDFALL_RASTER_TILE_TEMPLATE", "https://maps.example.org/{z}/{x}/{y}?key=SYNTHETIC_SECRET");
    vi.stubEnv("LANDFALL_RASTER_ATTRIBUTION_LABEL", "Synthetic contributors");
    vi.stubEnv("LANDFALL_RASTER_ATTRIBUTION_URL", "https://maps.example.org/license");
    expect(await GET().json()).toEqual({ state: "NOT_CONFIGURED" });
  });
});

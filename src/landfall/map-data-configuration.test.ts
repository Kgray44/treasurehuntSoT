import { describe, expect, it } from "vitest";
import { configuredRasterMap } from "./map-data-configuration";

const environment = {
  LANDFALL_RASTER_TILE_TEMPLATE: "https://maps.example.org/tiles/{z}/{x}/{y}.png",
  LANDFALL_RASTER_ATTRIBUTION_LABEL: "Synthetic map contributors",
  LANDFALL_RASTER_ATTRIBUTION_URL: "https://maps.example.org/license",
};
describe("public deployed map metadata", () => {
  it("reports configuration without claiming reachability or offline rights", () => {
    expect(configuredRasterMap(environment)).toMatchObject({
      state: "CONFIGURED",
      offlineRights: "PROHIBITED",
      maxZoom: 19,
    });
    expect(configuredRasterMap({})).toEqual({ state: "NOT_CONFIGURED" });
  });
  it("fails closed on secret-bearing, executable, local or malformed endpoints", () => {
    for (const template of [
      "https://user:secret@maps.example.org/{z}/{x}/{y}",
      "https://maps.example.org/{z}/{x}/{y}?key=secret",
      "http://maps.example.org/{z}/{x}/{y}",
      "javascript:alert(1)",
      "https://localhost/{z}/{x}/{y}",
      "https://127.0.0.1/{z}/{x}/{y}",
      "https://192.168.1.1/{z}/{x}/{y}",
      "https://maps.example.org/{z}/{x}",
      "https://maps.example.org/{z}/{x}/{y}/{s}",
      "https://{z}.example.org/{x}/{y}",
    ])
      expect(configuredRasterMap({ ...environment, LANDFALL_RASTER_TILE_TEMPLATE: template })).toEqual({
        state: "NOT_CONFIGURED",
      });
    expect(configuredRasterMap({ ...environment, LANDFALL_RASTER_ATTRIBUTION_LABEL: "<img src=x>" })).toEqual({
      state: "NOT_CONFIGURED",
    });
    expect(configuredRasterMap({ ...environment, LANDFALL_RASTER_MAX_ZOOM: "99" })).toEqual({
      state: "NOT_CONFIGURED",
    });
  });
});

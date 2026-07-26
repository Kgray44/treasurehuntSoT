import { describe, expect, it } from "vitest";
import { publicVoyageLogLocation } from "./voyage-log-location";

describe("Voyage Log public location safety", () => {
  it("omits private locations and generalizes approximate places", () => {
    expect(publicVoyageLogLocation({ classification: "PRIVATE_REAL_WORLD" })).toEqual({});
    expect(
      publicVoyageLogLocation({ classification: "APPROXIMATE_REAL_WORLD", generalizedLabel: "Northern Vermont" }),
    ).toEqual({ classification: "APPROXIMATE_REAL_WORLD", label: "Northern Vermont" });
  });

  it("rejects private-source locations, exact coordinates without permission, and raw routes", () => {
    expect(() => publicVoyageLogLocation({ classification: "PRIVATE_REAL_WORLD", label: "Home" })).toThrow("omitted");
    expect(() =>
      publicVoyageLogLocation({
        classification: "APPROXIMATE_REAL_WORLD",
        generalizedLabel: "Northern Vermont",
        latitude: 44.4,
        longitude: -72.0,
      }),
    ).toThrow("cannot contain exact coordinates");
    expect(() =>
      publicVoyageLogLocation({
        classification: "PUBLIC_REAL_WORLD",
        label: "Harbor",
        latitude: 44.4,
        longitude: -72.0,
      }),
    ).toThrow("permission");
    expect(() =>
      publicVoyageLogLocation({
        classification: "PUBLIC_REAL_WORLD",
        label: "Harbor",
        latitude: 44.4,
        longitude: -72.0,
        publicLocationPermission: true,
        routeGeometry: [],
      }),
    ).toThrow("route geometry");
  });

  it("permits only explicitly public, bounded exact coordinates", () => {
    expect(
      publicVoyageLogLocation({
        classification: "PUBLIC_REAL_WORLD",
        label: "Public Harbor",
        latitude: 44.4,
        longitude: -72.0,
        publicLocationPermission: true,
      }),
    ).toEqual({ classification: "PUBLIC_REAL_WORLD", label: "Public Harbor", latitude: 44.4, longitude: -72 });
  });
});

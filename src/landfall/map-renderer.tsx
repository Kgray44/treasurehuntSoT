"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { mapLibreFeatures, type LandfallCurrentPosition, type LandfallMapScene } from "@/landfall/map-projection";
import { validateLandfallMapStyle } from "@/landfall/map-style";
import { StaticPhysicalChart } from "@/landfall/static-physical-chart";
import { mapDataConfigurationSchema, type RasterMapConfiguration } from "@/landfall/map-data-configuration";

/** A map-data provider is trusted application code, not Creator-supplied style JSON or URL. */
export type LandfallMapDataProvider = Readonly<{
  id: string;
  /** Omission fails closed as third-party. A local provider cannot contain URLs. */
  privacy?: "LOCAL" | "FIRST_PARTY" | "THIRD_PARTY";
  style: () => Promise<import("maplibre-gl").StyleSpecification>;
}>;

/** Optional Creator interaction on the same renderer used by the Player Chart. */
export type LandfallMapInteraction = Readonly<{
  onPlace: (x: number, y: number) => void;
  onSelect: (featureId: string) => void;
  onMovePoint: (featureId: string, x: number, y: number) => void;
}>;

const blankStyle = (scene: LandfallMapScene): import("maplibre-gl").StyleSpecification => ({
  version: 8,
  sources: { landfall: { type: "geojson", data: mapLibreFeatures(scene) } },
  layers: [
    { id: "landfall-background", type: "background", paint: { "background-color": scene.background } },
    {
      id: "landfall-polygons",
      type: "fill",
      source: "landfall",
      filter: ["==", ["get", "kind"], "POLYGON"],
      paint: {
        "fill-color": scene.foreground,
        "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.45, 0.25],
      },
    },
    {
      id: "landfall-lines",
      type: "line",
      source: "landfall",
      filter: ["in", ["get", "kind"], ["literal", ["LINE", "GATE"]]],
      paint: { "line-color": scene.foreground, "line-width": ["case", ["==", ["get", "selected"], true], 6, 3] },
    },
    {
      id: "landfall-points",
      type: "circle",
      source: "landfall",
      filter: ["==", ["get", "kind"], "POINT"],
      paint: { "circle-color": scene.foreground, "circle-radius": ["case", ["==", ["get", "selected"], true], 11, 8] },
    },
    {
      id: "landfall-position-halo",
      type: "circle",
      source: "landfall",
      filter: ["==", ["get", "kind"], "CURRENT_POSITION"],
      paint: { "circle-color": "#1878a8", "circle-opacity": 0.16, "circle-radius": 24 },
    },
    {
      id: "landfall-position",
      type: "circle",
      source: "landfall",
      filter: ["==", ["get", "kind"], "CURRENT_POSITION"],
      paint: {
        "circle-color": "#1878a8",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-radius": 7,
      },
    },
  ],
});

/** Explicitly enabled interactive tiles only; no offline download or prefetch. */
const rasterStyle = (
  scene: LandfallMapScene,
  configuration: RasterMapConfiguration,
): import("maplibre-gl").StyleSpecification => ({
  version: 8,
  sources: {
    "deployment-raster": {
      type: "raster",
      tiles: [configuration.tileTemplate],
      tileSize: 256,
      attribution: configuration.attributionLabel,
      maxzoom: configuration.maxZoom,
    },
  },
  layers: [
    { id: "provider-background", type: "background", paint: { "background-color": scene.background } },
    { id: "provider-tiles", type: "raster", source: "deployment-raster" },
  ],
});

function PhysicalMap({
  scene,
  provider,
  position,
  interaction,
}: {
  scene: LandfallMapScene;
  provider?: LandfallMapDataProvider;
  position?: LandfallCurrentPosition | null;
  interaction?: LandfallMapInteraction;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const positionRef = useRef(position);
  const sceneRef = useRef(scene);
  const interactionRef = useRef(interaction);
  const [failure, setFailure] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [raster, setRaster] = useState<RasterMapConfiguration | null>(null);
  const [rasterConsent, setRasterConsent] = useState<string | null>(null);
  const mapKey = `${scene.worldspaceId}:${scene.mapId}:${scene.baseProviderId ?? "authored"}`;
  const rasterEnabled = rasterConsent === mapKey;
  const providerNeedsConsent = Boolean(provider && (!provider.privacy || provider.privacy === "THIRD_PARTY"));
  const [rasterChecked, setRasterChecked] = useState(false);
  const overlaySignature = JSON.stringify(scene.overlays);
  useEffect(() => {
    if (provider || scene.baseProviderId !== "osm-standard") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let disposed = false;
    void fetch("/api/landfall/map-data", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("MAP_CONFIGURATION_UNAVAILABLE");
        const result = mapDataConfigurationSchema.parse(await response.json());
        if (!disposed) setRaster(result.state === "CONFIGURED" ? result : null);
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        if (!disposed) setRasterChecked(true);
      });
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [scene.mapId, scene.worldspaceId, scene.baseProviderId, provider]);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);
  useEffect(() => {
    sceneRef.current = scene;
    const source = mapRef.current?.getSource("landfall") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(mapLibreFeatures(scene, position));
  }, [scene, position]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (map.getLayer("landfall-background"))
      map.setPaintProperty("landfall-background", "background-color", scene.background);
    if (map.getLayer("landfall-polygons")) map.setPaintProperty("landfall-polygons", "fill-color", scene.foreground);
    if (map.getLayer("landfall-lines")) map.setPaintProperty("landfall-lines", "line-color", scene.foreground);
    if (map.getLayer("landfall-points")) map.setPaintProperty("landfall-points", "circle-color", scene.foreground);
  }, [scene.background, scene.foreground]);
  useEffect(() => {
    mapRef.current?.jumpTo({
      center: [...scene.camera.center],
      zoom: scene.camera.zoom,
      bearing: scene.camera.bearing,
    });
  }, [scene.camera.center, scene.camera.zoom, scene.camera.bearing]);
  useEffect(() => {
    if (!element.current) return;
    setLoaded(false);
    setFailure(false);
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;
    const start = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        const activeProvider = provider && (!providerNeedsConsent || rasterEnabled) ? provider : undefined;
        const suppliedBase = Boolean(activeProvider) || Boolean(rasterEnabled && raster);
        const base = activeProvider
          ? validateLandfallMapStyle(await activeProvider.style(), {
              privacy: activeProvider.privacy ?? "THIRD_PARTY",
              origin: window.location.origin,
            })
          : rasterEnabled && raster
            ? rasterStyle(scene, raster)
            : blankStyle(scene);
        if (disposed || !element.current) return;
        const availableOverlays = scene.overlays.filter((overlay) => Boolean(overlay.imageUrl));
        const overlaySources = Object.fromEntries(
          availableOverlays.map((overlay) => [
            `landfall-overlay-${overlay.id}`,
            {
              type: "image" as const,
              url: overlay.imageUrl!,
              coordinates: overlay.coordinates.map((point) => [...point]) as [number, number][],
            },
          ]),
        );
        const overlayLayers: import("maplibre-gl").LayerSpecification[] = availableOverlays.map((overlay) => ({
          id: `landfall-overlay-${overlay.id}`,
          type: "raster",
          source: `landfall-overlay-${overlay.id}`,
          paint: { "raster-opacity": overlay.opacity },
        }));
        // The provider supplies only a trusted base style. Landfall overlays are canonical.
        const style: import("maplibre-gl").StyleSpecification = {
          ...base,
          sources: {
            ...base.sources,
            ...overlaySources,
            landfall: { type: "geojson", data: mapLibreFeatures(scene, positionRef.current) },
          },
          layers: suppliedBase
            ? [
                ...base.layers.filter((layer) => !layer.id.startsWith("landfall-")),
                ...overlayLayers,
                ...blankStyle(scene).layers.filter((layer) => layer.id !== "landfall-background"),
              ]
            : [blankStyle(scene).layers[0], ...overlayLayers, ...blankStyle(scene).layers.slice(1)],
        };
        map = new maplibre.Map({
          container: element.current,
          style,
          center: [...sceneRef.current.camera.center],
          zoom: sceneRef.current.camera.zoom,
          bearing: sceneRef.current.camera.bearing,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.on("load", () => {
          const source = map?.getSource("landfall") as import("maplibre-gl").GeoJSONSource | undefined;
          source?.setData(mapLibreFeatures(sceneRef.current, positionRef.current));
          if (!disposed) setLoaded(true);
        });
        map.on("error", () => {
          if (!disposed) setFailure(true);
        });
        let dragging: string | null = null;
        map.on("mousedown", "landfall-points", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id !== "string" || !interactionRef.current) return;
          dragging = id;
          map?.dragPan.disable();
          interactionRef.current.onSelect(id);
        });
        map.on("mousemove", (event) => {
          if (!dragging || !map) return;
          const data = mapLibreFeatures(scene, positionRef.current);
          const point = data.features.find((item) => item.properties?.id === dragging);
          if (point && point.geometry.type === "Point") {
            point.geometry.coordinates = [event.lngLat.lng, event.lngLat.lat];
            (map.getSource("landfall") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(data);
          }
        });
        map.on("mouseup", (event) => {
          if (!dragging) return;
          const id = dragging;
          dragging = null;
          map?.dragPan.enable();
          interactionRef.current?.onMovePoint(id, event.lngLat.lng, event.lngLat.lat);
        });
        map.on("click", (event) => {
          if (!interactionRef.current) return;
          const selected = map?.queryRenderedFeatures(event.point, {
            layers: ["landfall-points", "landfall-lines", "landfall-polygons"],
          })[0]?.properties?.id;
          if (typeof selected === "string") interactionRef.current.onSelect(selected);
          else interactionRef.current.onPlace(event.lngLat.lng, event.lngLat.lat);
        });
      } catch {
        if (!disposed) setFailure(true);
      }
    };
    void start();
    return () => {
      disposed = true;
      mapRef.current = null;
      map?.remove();
    };
    // The mounted Player scene is immutable by map/worldspace identity; only its
    // ephemeral position changes. Position updates use GeoJSON setData above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.mapId, scene.worldspaceId, provider, providerNeedsConsent, overlaySignature, raster, rasterEnabled]);
  return (
    <div>
      {providerNeedsConsent && (
        <div>
          <p>Online background maps share the displayed map area with the configured map provider.</p>
          <button type="button" onClick={() => setRasterConsent(rasterEnabled ? null : mapKey)}>
            {rasterEnabled ? "Stop loading online background maps" : "Load online background maps"}
          </button>
        </div>
      )}
      {!provider &&
        scene.baseProviderId === "osm-standard" &&
        (raster ? (
          <div>
            <p>Online background maps share the displayed map area with {new URL(raster.tileTemplate).hostname}.</p>
            <button type="button" onClick={() => setRasterConsent(rasterEnabled ? null : mapKey)}>
              {rasterEnabled ? "Stop loading online background maps" : "Load online background maps"}
            </button>
            {rasterEnabled && (
              <p>
                <a href={raster.attributionUrl} rel="noreferrer">
                  {raster.attributionLabel}
                </a>
              </p>
            )}
          </div>
        ) : (
          rasterChecked && <p>Online background maps are not configured. Your released chart remains available.</p>
        ))}
      <div style={{ width: "100%", height: 320, position: "relative" }} aria-label="Physical Landfall map">
        {(!loaded || failure) && <StaticPhysicalChart scene={scene} />}
        <div
          ref={element}
          aria-hidden={!loaded || failure}
          style={{
            position: "absolute",
            inset: 0,
            opacity: loaded && !failure ? 1 : 0,
            pointerEvents: loaded && !failure ? "auto" : "none",
          }}
        />
      </div>
      {position && (
        <p role="status">
          {loaded && !failure ? "Current position shown. " : ""}Location signal:{" "}
          {position.confidence.toLowerCase().replaceAll("_", " ")}. Estimated accuracy:{" "}
          {Math.round(position.accuracyMeters)} meters.
        </p>
      )}
      {failure && <p role="status">Map data is unavailable. Use the location list and route summary.</p>}
      <ul aria-label="Visible map locations">
        {scene.features.map((item) => (
          <li key={item.id} data-selected={item.id === scene.selectedFeatureId ? "true" : undefined}>
            {interaction ? (
              <button type="button" onClick={() => interaction.onSelect(item.id)}>
                {item.label}
              </button>
            ) : (
              <>
                {item.label}
                {item.id === scene.selectedFeatureId ? " · selected for viewing" : ""}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VirtualMap({ scene, interaction }: { scene: LandfallMapScene; interaction?: LandfallMapInteraction }) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const coordinate = (event: React.PointerEvent<SVGElement>) => {
    const inverse = svg.current?.getScreenCTM()?.inverse();
    if (!inverse) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    return { x: point.x, y: point.y };
  };
  const bounds = scene.bounds;
  if (!bounds) return <p role="status">Virtual map bounds are unavailable.</p>;
  const width = bounds.maxX - bounds.minX,
    height = bounds.maxY - bounds.minY;
  const imageUrl = scene.imageUrl ?? null;
  return (
    <div>
      <svg
        ref={svg}
        role="img"
        aria-label="Virtual Landfall chart"
        viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
        style={{ width: "100%", maxHeight: 400, background: scene.background }}
        onClick={(event) => {
          if (!interaction || (event.target as Element).closest("[data-landfall-feature]")) return;
          const point = coordinate(event as unknown as React.PointerEvent<SVGElement>);
          if (point) interaction.onPlace(point.x, point.y);
        }}
      >
        {imageUrl && (
          <image
            href={imageUrl}
            x={bounds.minX}
            y={bounds.minY}
            width={width}
            height={height}
            preserveAspectRatio="none"
          />
        )}
        {scene.features.map((item) =>
          item.hiddenCenter ? null : item.kind === "POINT" ? (
            <circle
              key={item.id}
              data-landfall-feature={item.id}
              cx={drag?.id === item.id ? drag.x : item.coordinates[0][0]}
              cy={drag?.id === item.id ? drag.y : item.coordinates[0][1]}
              r={Math.min(width, height) * (item.id === scene.selectedFeatureId ? 0.023 : 0.015)}
              fill={scene.foreground}
              onPointerDown={(event) => {
                if (!interaction) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                interaction.onSelect(item.id);
                setDrag({ id: item.id, x: item.coordinates[0][0], y: item.coordinates[0][1] });
              }}
              onPointerMove={(event) => {
                if (!drag || drag.id !== item.id) return;
                const point = coordinate(event);
                if (point) setDrag({ id: item.id, ...point });
              }}
              onPointerUp={(event) => {
                if (!drag || drag.id !== item.id) return;
                const point = coordinate(event);
                if (point) interaction?.onMovePoint(item.id, point.x, point.y);
                setDrag(null);
              }}
            />
          ) : item.kind === "POLYGON" ? (
            <path
              key={item.id}
              data-landfall-feature={item.id}
              d={(item.polygons ?? [[item.coordinates]])
                .map((polygon) =>
                  polygon
                    .map((ring) => ring.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z")
                    .join(" "),
                )
                .join(" ")}
              fill={scene.foreground}
              fillRule="evenodd"
              fillOpacity={item.id === scene.selectedFeatureId ? 0.45 : 0.2}
              stroke={scene.foreground}
              strokeWidth={Math.min(width, height) * (item.id === scene.selectedFeatureId ? 0.012 : 0.006)}
              onClick={() => interaction?.onSelect(item.id)}
            />
          ) : (
            <polyline
              key={item.id}
              data-landfall-feature={item.id}
              points={item.coordinates.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={scene.foreground}
              strokeWidth={Math.min(width, height) * (item.id === scene.selectedFeatureId ? 0.012 : 0.006)}
              onClick={() => interaction?.onSelect(item.id)}
            />
          ),
        )}
      </svg>
      <ul aria-label="Visible map locations">
        {scene.features.map((item) => (
          <li key={item.id} data-selected={item.id === scene.selectedFeatureId ? "true" : undefined}>
            {interaction ? (
              <button type="button" onClick={() => interaction.onSelect(item.id)}>
                {item.label}
              </button>
            ) : (
              <>
                {item.label}
                {item.id === scene.selectedFeatureId ? " · selected for viewing" : ""}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandfallMapRenderer({
  scene,
  provider,
  interaction,
}: {
  scene: LandfallMapScene;
  provider?: LandfallMapDataProvider;
  interaction?: LandfallMapInteraction;
}) {
  return (
    <section aria-label="Landfall map preview">
      {scene.worldspaceKind === "PHYSICAL" ? (
        <PhysicalMap
          key={`${scene.worldspaceId}:${scene.mapId}:${scene.baseProviderId ?? "authored"}:${provider?.id ?? "default"}:${provider?.privacy ?? "THIRD_PARTY"}`}
          scene={scene}
          provider={provider}
          position={scene.currentPosition}
          interaction={interaction}
        />
      ) : (
        <VirtualMap scene={scene} interaction={interaction} />
      )}
      {scene.attribution.length > 0 && (
        <p>
          {scene.attribution.map((item) => (
            <a key={item.url} href={item.url} rel="noreferrer">
              {item.label}
            </a>
          ))}
        </p>
      )}
      {scene.overlays
        .filter((item) => Boolean(item.imageUrl))
        .map((item) => (
          <p key={item.id}>
            Overlay:{" "}
            <a href={item.attributionUrl} rel="noreferrer">
              {item.attributionLabel}
            </a>
          </p>
        ))}
    </section>
  );
}

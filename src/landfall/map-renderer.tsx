"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { mapLibreFeatures, type LandfallCurrentPosition, type LandfallMapScene } from "@/landfall/map-projection";
import { validateLandfallMapStyle } from "@/landfall/map-style";

/** A map-data provider is trusted application code, not Creator-supplied style JSON or URL. */
export type LandfallMapDataProvider = Readonly<{
  id: string;
  style: () => Promise<import("maplibre-gl").StyleSpecification>;
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
      paint: { "fill-color": scene.foreground, "fill-opacity": 0.25 },
    },
    {
      id: "landfall-lines",
      type: "line",
      source: "landfall",
      filter: ["in", ["get", "kind"], ["literal", ["LINE", "GATE"]]],
      paint: { "line-color": scene.foreground, "line-width": 3 },
    },
    {
      id: "landfall-points",
      type: "circle",
      source: "landfall",
      filter: ["==", ["get", "kind"], "POINT"],
      paint: { "circle-color": scene.foreground, "circle-radius": 8 },
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
      paint: { "circle-color": "#1878a8", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-radius": 7 },
    },
  ],
});

function PhysicalMap({ scene, provider, position }: { scene: LandfallMapScene; provider?: LandfallMapDataProvider; position?: LandfallCurrentPosition | null }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const positionRef = useRef(position);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    const source = mapRef.current?.getSource("landfall") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(mapLibreFeatures(scene, position));
  }, [scene, position]);
  useEffect(() => {
    if (!element.current) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;
    const start = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        const base = provider ? validateLandfallMapStyle(await provider.style()) : blankStyle(scene);
        if (disposed || !element.current) return;
        // The provider supplies only a trusted base style. Landfall overlays are canonical.
        const style: import("maplibre-gl").StyleSpecification = {
          ...base,
          sources: { ...base.sources, landfall: { type: "geojson", data: mapLibreFeatures(scene, positionRef.current) } },
          layers: [
            ...base.layers.filter((layer) => !layer.id.startsWith("landfall-")),
            ...blankStyle(scene).layers.filter((layer) => layer.id !== "landfall-background"),
          ],
        };
        map = new maplibre.Map({
          container: element.current,
          style,
          center: [...scene.camera.center],
          zoom: scene.camera.zoom,
          bearing: scene.camera.bearing,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.on("load", () => {
          const source = map?.getSource("landfall") as import("maplibre-gl").GeoJSONSource | undefined;
          source?.setData(mapLibreFeatures(scene, positionRef.current));
        });
        map.on("error", () => setFailure(true));
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
  }, [scene.mapId, scene.worldspaceId, provider]);
  return (
    <div>
      <div ref={element} style={{ width: "100%", height: 320 }} aria-label="Physical Landfall map" />
      {position && <p role="status">Current position shown. Location signal: {position.confidence.toLowerCase().replaceAll("_", " ")}. Estimated accuracy: {Math.round(position.accuracyMeters)} meters.</p>}
      {failure && <p role="status">Map data is unavailable. Use the location list and route summary.</p>}
      <ul aria-label="Visible map locations">
        {scene.features.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

function VirtualMap({ scene }: { scene: LandfallMapScene }) {
  const bounds = scene.bounds;
  if (!bounds) return <p role="status">Virtual map bounds are unavailable.</p>;
  const width = bounds.maxX - bounds.minX,
    height = bounds.maxY - bounds.minY;
  const imageUrl = scene.imageUrl ?? null;
  return (
    <div>
      <svg
        role="img"
        aria-label="Virtual Landfall chart"
        viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
        style={{ width: "100%", maxHeight: 400, background: scene.background }}
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
              cx={item.coordinates[0][0]}
              cy={item.coordinates[0][1]}
              r={Math.min(width, height) * 0.015}
              fill={scene.foreground}
            />
          ) : item.kind === "POLYGON" ? (
            <path
              key={item.id}
              d={(item.polygons ?? [[item.coordinates]])
                .map((polygon) =>
                  polygon
                    .map((ring) => ring.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z")
                    .join(" "),
                )
                .join(" ")}
              fill={scene.foreground}
              fillRule="evenodd"
              fillOpacity={0.2}
              stroke={scene.foreground}
              strokeWidth={Math.min(width, height) * 0.006}
            />
          ) : (
            <polyline
              key={item.id}
              points={item.coordinates.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={scene.foreground}
              strokeWidth={Math.min(width, height) * 0.006}
            />
          ),
        )}
      </svg>
      <ul aria-label="Visible map locations">
        {scene.features.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function LandfallMapRenderer({
  scene,
  provider,
}: {
  scene: LandfallMapScene;
  provider?: LandfallMapDataProvider;
}) {
  return (
    <section aria-label="Landfall map preview">
      {scene.worldspaceKind === "PHYSICAL" ? (
        <PhysicalMap scene={scene} provider={provider} position={scene.currentPosition} />
      ) : (
        <VirtualMap scene={scene} />
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
    </section>
  );
}

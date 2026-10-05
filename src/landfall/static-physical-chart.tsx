import type { LandfallMapScene, LandfallCurrentPosition } from "@/landfall/map-projection";

/** Read-only rendering of the already released projection; no provider, acquisition or progression. */
export function StaticPhysicalChart({
  scene,
  position,
}: {
  scene: LandfallMapScene;
  position?: LandfallCurrentPosition | null;
}) {
  const visible = scene.features.filter((feature) => !feature.hiddenCenter);
  const anchor = scene.camera.center[0];
  const project = ([longitude, latitude]: readonly [number, number]) => {
    const relative = ((((longitude - anchor + 180) % 360) + 360) % 360) - 180;
    const radians = (Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180;
    return [(relative * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + radians / 2))] as const;
  };
  const points = visible.flatMap((feature) =>
    [...feature.coordinates, ...(feature.polygons?.flat(2) ?? [])].map(project),
  );
  const livePosition =
    scene.worldspaceKind === "PHYSICAL" &&
    position &&
    position.coordinates.every(Number.isFinite) &&
    Math.abs(position.coordinates[0]) <= 180 &&
    Math.abs(position.coordinates[1]) <= 90 &&
    Number.isFinite(position.accuracyMeters) &&
    position.accuracyMeters > 0
      ? position
      : null;
  if (livePosition) points.push(project(livePosition.coordinates));
  if (!points.length) return <p>No released geometry is available. Use the location list and route summary.</p>;
  const { minX, maxX, minY, maxY } = points.reduce(
    (bounds, [x, y]) => ({
      minX: Math.min(bounds.minX, x),
      maxX: Math.max(bounds.maxX, x),
      minY: Math.min(bounds.minY, y),
      maxY: Math.max(bounds.maxY, y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const span = Math.max(maxX - minX, maxY - minY, 0.000001);
  const draw = (coordinate: readonly [number, number]) => {
    const [x, y] = project(coordinate);
    return [500 + ((x - (minX + maxX) / 2) / span) * 840, 500 + ((y - (minY + maxY) / 2) / span) * 840] as const;
  };
  return (
    <svg
      role="img"
      aria-label="Released physical chart"
      viewBox="0 0 1000 1000"
      style={{ width: "100%", height: "100%", background: scene.background }}
    >
      <title>Released chart overview</title>
      <desc>Only released locations and routes are shown. Use the location list and route summary for details.</desc>
      {visible.map((feature) => {
        const selected = feature.id === scene.selectedFeatureId;
        const attributes = { "data-landfall-feature": feature.id, "data-selected": selected ? "true" : undefined };
        const title = (
          <title>
            {feature.label}
            {selected ? " · selected for viewing" : ""}
          </title>
        );
        if (feature.kind === "POINT") {
          if (!feature.coordinates[0]) return null;
          const [x, y] = draw(feature.coordinates[0]);
          return (
            <circle key={feature.id} {...attributes} cx={x} cy={y} r={selected ? 24 : 15} fill={scene.foreground}>
              {title}
            </circle>
          );
        }
        if (feature.kind === "POLYGON") {
          const outline = (feature.polygons ?? [[feature.coordinates]])
            .map((polygon) =>
              polygon
                .map(
                  (ring) =>
                    ring
                      .map((coordinate, index) => {
                        const [x, y] = draw(coordinate);
                        return `${index ? "L" : "M"}${x} ${y}`;
                      })
                      .join(" ") + " Z",
                )
                .join(" "),
            )
            .join(" ");
          return (
            <path
              key={feature.id}
              {...attributes}
              d={outline}
              fill={scene.foreground}
              fillRule="evenodd"
              fillOpacity={selected ? 0.45 : 0.2}
              stroke={scene.foreground}
              strokeWidth={selected ? 12 : 6}
            >
              {title}
            </path>
          );
        }
        return (
          <polyline
            key={feature.id}
            {...attributes}
            points={feature.coordinates.map((coordinate) => draw(coordinate).join(",")).join(" ")}
            fill="none"
            stroke={scene.foreground}
            strokeWidth={selected ? 12 : 6}
          >
            {title}
          </polyline>
        );
      })}
      {livePosition &&
        (() => {
          const [x, y] = draw(livePosition.coordinates);
          return (
            <g data-landfall-current-position="true">
              <title>
                Current foreground position · estimated accuracy {Math.round(livePosition.accuracyMeters)} meters
              </title>
              <circle cx={x} cy={y} r={24} fill="#1878a8" stroke="#ffffff" strokeWidth={6} />
            </g>
          );
        })()}
    </svg>
  );
}

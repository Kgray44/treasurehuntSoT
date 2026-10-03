"use client";

import { defaultContextPrivacy } from "@/landfall/context-projection";
import { useState } from "react";
import type { Asset } from "@/components/studio/studio-types";
import type {
  LandfallDefinition,
  LandfallGeometry,
  LandfallMapDefinition,
  LandfallRoute,
  LandfallWaypoint,
  LandfallWorldspace,
} from "@/landfall/schema";

type Region = NonNullable<LandfallDefinition["context"]>["regions"][number];
type Landmark = NonNullable<LandfallDefinition["context"]>["landmarks"][number];
const kinds: Region["kind"][] = [
  "SITE",
  "BUILDING",
  "FLOOR",
  "WING",
  "ROOM",
  "GALLERY",
  "CORRIDOR",
  "EXHIBIT_ZONE",
  "OUTDOOR_COMPACT",
  "ENTRANCE",
  "EXIT",
  "STAIRS",
];
const privacy: Region["privacyClassification"][] = [
  "FICTIONAL",
  "GENERIC",
  "PUBLIC_REAL_WORLD",
  "APPROXIMATE_REAL_WORLD",
  "PRIVATE_REAL_WORLD",
];
const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");

/** Ordinary draft controls reuse the chart canvas and Chronicle asset library. */
export function LandfallContextEditor({
  definition,
  worldspace,
  map,
  assets,
  waypoint,
  route,
  selectedRegionId,
  onSelectRegion,
  onDrawRegion,
  onChange,
  onSelectMap,
}: {
  definition: LandfallDefinition;
  worldspace: LandfallWorldspace;
  map: LandfallMapDefinition;
  assets: Asset[];
  waypoint?: LandfallWaypoint;
  route?: LandfallRoute;
  selectedRegionId: string | null;
  onSelectRegion: (id: string | null) => void;
  onDrawRegion: (id: string, shape: "POLYGON" | "CORRIDOR" | "GATE") => void;
  onChange: (definition: LandfallDefinition) => boolean;
  onSelectMap: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Region["kind"]>("ROOM");
  const [level, setLevel] = useState("");
  const [regionLevel, setRegionLevel] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const context = definition.context ?? { regions: [], landmarks: [] };
  const regions = context.regions.filter((item) => item.worldspaceId === worldspace.id);
  const selected = regions.find((item) => item.id === selectedRegionId);
  const landmark = context.landmarks.find((item) => item.waypointId === waypoint?.id);
  const images = assets.filter(
    (asset) =>
      asset.mimeType.startsWith("image/") && asset.variants.some((variant) => variant.processingState === "READY"),
  );
  const updateRegion = (patch: Partial<Region>) =>
    selected &&
    onChange({
      ...definition,
      context: {
        ...context,
        regions: context.regions.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)),
      },
    });
  const updateLandmark = (patch: Partial<Landmark>) =>
    landmark &&
    onChange({
      ...definition,
      context: {
        ...context,
        landmarks: context.landmarks.map((item) => (item.id === landmark.id ? { ...item, ...patch } : item)),
      },
      ...(patch.fallback
        ? {
            waypoints: definition.waypoints.map((item) =>
              item.id === landmark.waypointId ? { ...item, fallback: patch.fallback! } : item,
            ),
          }
        : {}),
    });

  function addRegion() {
    if (!name.trim()) return;
    const region: Region = {
      id: crypto.randomUUID(),
      worldspaceId: worldspace.id,
      mapId: map.id,
      name: name.trim(),
      kind,
      ...(regionLevel.trim() || map.level ? { level: regionLevel.trim() || map.level } : {}),
      geometry: { type: "POINT_RADIUS", center: map.camera.center, radius: worldspace.kind === "PHYSICAL" ? 10 : 30 },
      privacyClassification: defaultContextPrivacy(worldspace),
      hiddenUntilRevealed: false,
    };
    if (onChange({ ...definition, context: { ...context, regions: [...context.regions, region] } })) {
      onSelectRegion(region.id);
      setName("");
    }
  }

  function addFloor() {
    if (!level.trim()) return;
    const floor = {
      ...map,
      id: crypto.randomUUID(),
      name: `${worldspace.name} · ${level.trim()}`,
      role: "FLOOR" as const,
      level: level.trim(),
      overlays: map.overlays?.map((overlay) => ({ ...overlay, id: crypto.randomUUID() })),
    };
    if (
      onChange({
        ...definition,
        maps: [...definition.maps, floor],
        worldspaces: definition.worldspaces.map((item) =>
          item.id === worldspace.id ? { ...item, mapDefinitionIds: [...item.mapDefinitionIds, floor.id] } : item,
        ),
      })
    ) {
      onSelectMap(floor.id);
      onSelectRegion(null);
      setLevel("");
    }
  }

  function addLandmark() {
    const visualSource = worldspace.kind === "PHYSICAL" ? "VISION_WAYPOINT" : "WATCHGLASS";
    const regionId = waypoint?.regionId ?? selected?.id;
    const region = regions.find((item) => item.id === regionId);
    if (!waypoint || !region || region.mapId !== waypoint.mapId || !referenceId) return;
    const next: Landmark = {
      id: crypto.randomUUID(),
      regionId: region.id,
      waypointId: waypoint.id,
      name: waypoint.name,
      guidance: `Find ${waypoint.name}. If recognition is unavailable, use the configured fallback.`,
      referenceAssetIds: [referenceId],
      negativeReferenceAssetIds: [],
      minimumFrames: 2,
      fallback: waypoint.fallback,
      privacyClassification: region.privacyClassification,
    };
    onChange({
      ...definition,
      context: { ...context, landmarks: [...context.landmarks, next] },
      waypoints: definition.waypoints.map((item) =>
        item.id === waypoint.id
          ? {
              ...item,
              regionId,
              landmarkId: next.id,
              type: "NATURAL_LANDMARK",
              evidenceProfile: {
                ...item.evidenceProfile,
                acceptedSources: item.evidenceProfile.acceptedSources.includes(visualSource)
                  ? item.evidenceProfile.acceptedSources
                  : [...item.evidenceProfile.acceptedSources, visualSource],
              },
            }
          : item,
      ),
      worldspaces: definition.worldspaces.map((item) =>
        item.id === waypoint.worldspaceId
          ? {
              ...item,
              observationPolicy: {
                ...item.observationPolicy,
                allowedSources: item.observationPolicy.allowedSources.includes(visualSource)
                  ? item.observationPolicy.allowedSources
                  : [...item.observationPolicy.allowedSources, visualSource],
              },
            }
          : item,
      ),
    });
  }

  function removeRegion() {
    if (!selected) return;
    const removedLandmarks = new Set(
      context.landmarks.filter((item) => item.regionId === selected.id).map((item) => item.id),
    );
    if (
      onChange({
        ...definition,
        context: {
          regions: context.regions
            .filter((item) => item.id !== selected.id)
            .map((item) => (item.parentId === selected.id ? { ...item, parentId: undefined } : item)),
          landmarks: context.landmarks.filter((item) => !removedLandmarks.has(item.id)),
        },
        waypoints: definition.waypoints.map((item) => ({
          ...item,
          ...(item.regionId === selected.id ? { regionId: undefined } : {}),
          ...(item.landmarkId && removedLandmarks.has(item.landmarkId) ? { landmarkId: undefined } : {}),
        })),
        routes: definition.routes.map((item) =>
          item.segmentRegionIds?.includes(selected.id) ? { ...item, segmentRegionIds: undefined } : item,
        ),
      })
    )
      onSelectRegion(null);
  }

  function references(negative: boolean) {
    if (!landmark) return null;
    const field = negative ? "negativeReferenceAssetIds" : "referenceAssetIds";
    const other = negative ? landmark.referenceAssetIds : landmark.negativeReferenceAssetIds;
    return (
      <fieldset>
        <legend>{negative ? "Similar things to exclude" : "Positive landmark references"} (up to 8)</legend>
        {images.length ? (
          images.map((asset) => (
            <label key={asset.id} className="landfall-check">
              <input
                type="checkbox"
                checked={landmark[field].includes(asset.id)}
                disabled={
                  !landmark[field].includes(asset.id) && (landmark[field].length >= 8 || other.includes(asset.id))
                }
                onChange={(event) =>
                  updateLandmark({
                    [field]: event.target.checked
                      ? [...landmark[field], asset.id]
                      : landmark[field].filter((id) => id !== asset.id),
                  })
                }
              />
              {asset.displayName}
            </label>
          ))
        ) : (
          <p>Upload images in the Chronicle asset library, then return here.</p>
        )}
      </fieldset>
    );
  }

  return (
    <section aria-label="Floors, regions and landmarks" className="landfall-inspector-fields landfall-context-editor">
      <h3>Floors, regions and landmarks</h3>
      <p>
        {worldspace.kind === "VIRTUAL"
          ? "Virtual regions and landmarks use authored map coordinates. Visual verification needs a configured certified Watchglass provider; keep an observation, Player or Captain fallback."
          : "GPS can establish a broad site or building. Room and floor guidance stays uncertain until independently verified."}
      </p>
      <fieldset>
        <legend>Floor charts</legend>
        <label>
          Floor label
          <input
            value={level}
            maxLength={80}
            onChange={(event) => setLevel(event.target.value)}
            placeholder="Ground floor"
          />
        </label>
        <button type="button" disabled={!level.trim()} onClick={addFloor}>
          Add floor chart
        </button>
        <p>
          A floor chart starts with this map&apos;s aligned overlays. Select its map inspector to choose a floor-plan
          image and adjust overlay bounds.
        </p>
      </fieldset>
      <fieldset>
        <legend>Add a region on this chart</legend>
        <label>
          Region name
          <input value={name} maxLength={240} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Region kind
          <select value={kind} onChange={(event) => setKind(event.target.value as Region["kind"])}>
            {kinds.map((item) => (
              <option key={item} value={item}>
                {readable(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          New region floor or level
          <input
            value={regionLevel}
            maxLength={80}
            placeholder={map.level ?? "Optional except for floors"}
            onChange={(event) => setRegionLevel(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!name.trim() || (kind === "FLOOR" && !regionLevel.trim() && !map.level)}
          onClick={addRegion}
        >
          Add region
        </button>
      </fieldset>
      <label>
        Inspect region
        <select value={selectedRegionId ?? ""} onChange={(event) => onSelectRegion(event.target.value || null)}>
          <option value="">Choose a region</option>
          {regions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {readable(item.kind)}
              {item.level ? ` · ${item.level}` : ""}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <fieldset key={selected.id}>
          <legend>{selected.name}</legend>
          {worldspace.kind === "PHYSICAL" && (
            <p>
              {selected.privacyClassification === "PRIVATE_REAL_WORLD"
                ? "Authorized Players receive the exact released layout for this Chronicle. Public and Community maps cannot receive it; restrict the Chronicle before publishing."
                : selected.privacyClassification === "APPROXIMATE_REAL_WORLD" ||
                    selected.privacyClassification === "GENERIC"
                  ? "Players receive a generalized broad area, with reduced public precision. Rooms, floors and exact targets need a private layout or an intentionally public exact location before publishing."
                  : "Authorized Players use the exact released geometry. Intentionally public locations may expose that geometry publicly; this does not share a Player's live position."}
            </p>
          )}
          <label>
            Region name
            <input
              defaultValue={selected.name}
              maxLength={240}
              onBlur={(event) => updateRegion({ name: event.target.value.trim() || selected.name })}
            />
          </label>
          <label>
            Kind
            <select
              value={selected.kind}
              onChange={(event) => updateRegion({ kind: event.target.value as Region["kind"] })}
            >
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Parent region
            <select
              value={selected.parentId ?? ""}
              onChange={(event) => updateRegion({ parentId: event.target.value || undefined })}
            >
              <option value="">No parent</option>
              {regions
                .filter((item) => item.id !== selected.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Floor or level
            <input
              defaultValue={selected.level ?? map.level ?? ""}
              maxLength={80}
              onBlur={(event) => updateRegion({ level: event.target.value.trim() || undefined })}
            />
          </label>
          <label>
            Region chart
            <select value={selected.mapId} onChange={(event) => updateRegion({ mapId: event.target.value })}>
              {definition.maps
                .filter((item) => item.worldspaceId === worldspace.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Privacy
            <select
              value={selected.privacyClassification}
              onChange={(event) =>
                updateRegion({ privacyClassification: event.target.value as Region["privacyClassification"] })
              }
            >
              {privacy.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="landfall-check">
            <input
              type="checkbox"
              checked={selected.hiddenUntilRevealed}
              onChange={(event) => updateRegion({ hiddenUntilRevealed: event.target.checked })}
            />
            Hidden until revealed
          </label>
          <p>Shape: {readable(selected.geometry.type)}. Draw on the chart, then choose Finish shape.</p>
          <button type="button" onClick={() => onDrawRegion(selected.id, "POLYGON")}>
            Draw region boundary
          </button>
          <button type="button" onClick={() => onDrawRegion(selected.id, "CORRIDOR")}>
            Draw region corridor
          </button>
          <button type="button" onClick={() => onDrawRegion(selected.id, "GATE")}>
            Draw entrance or exit
          </button>
          {(selected.geometry.type === "POINT_RADIUS" || selected.geometry.type === "CORRIDOR") && (
            <label>
              {selected.geometry.type === "CORRIDOR" ? "Corridor width" : "Region radius"}
              <input
                type="number"
                min="0.01"
                max="100000"
                step="any"
                key={JSON.stringify(selected.geometry)}
                defaultValue={
                  selected.geometry.type === "CORRIDOR" ? selected.geometry.width : selected.geometry.radius
                }
                onBlur={(event) =>
                  updateRegion({
                    geometry: {
                      ...selected.geometry,
                      [selected.geometry.type === "CORRIDOR" ? "width" : "radius"]: Number(event.target.value),
                    } as LandfallGeometry,
                  })
                }
              />
            </label>
          )}
          <button type="button" onClick={removeRegion}>
            Remove region and its landmark associations
          </button>
        </fieldset>
      )}
      {waypoint && (
        <fieldset>
          <legend>Waypoint region · {waypoint.name}</legend>
          <label>
            Context region
            <select
              value={waypoint.regionId ?? ""}
              disabled={Boolean(landmark)}
              onChange={(event) =>
                onChange({
                  ...definition,
                  waypoints: definition.waypoints.map((item) =>
                    item.id === waypoint.id ? { ...item, regionId: event.target.value || undefined } : item,
                  ),
                })
              }
            >
              <option value="">No region</option>
              {regions
                .filter((item) => item.mapId === waypoint.mapId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {!landmark && (
            <>
              <label>
                First positive reference
                <select value={referenceId} onChange={(event) => setReferenceId(event.target.value)}>
                  <option value="">Choose a Chronicle image</option>
                  {images.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!(waypoint.regionId || (selected?.mapId === waypoint.mapId && selected.id)) || !referenceId}
                onClick={addLandmark}
              >
                Add natural landmark
              </button>
            </>
          )}
        </fieldset>
      )}
      {route?.geometry && (route.geometry.type === "ROUTE_LINE" || route.geometry.type === "CORRIDOR") && (
        <fieldset>
          <legend>Route segment regions · {route.name}</legend>
          {route.geometry.points.slice(1).map((_, index) => (
            <label key={index}>
              Segment {index + 1}
              <select
                value={route.segmentRegionIds?.[index] ?? ""}
                onChange={(event) => {
                  const ids =
                    route.segmentRegionIds ??
                    Array.from(
                      { length: route.geometry && "points" in route.geometry ? route.geometry.points.length - 1 : 0 },
                      () => regions[0]?.id ?? "",
                    );
                  onChange({
                    ...definition,
                    routes: definition.routes.map((item) =>
                      item.id === route.id
                        ? {
                            ...item,
                            segmentRegionIds: ids.map((value, i) => (i === index ? event.target.value : value)),
                          }
                        : item,
                    ),
                  });
                }}
              >
                <option value="" disabled>
                  Choose a region
                </option>
                {regions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...definition,
                routes: definition.routes.map((item) =>
                  item.id === route.id ? { ...item, segmentRegionIds: undefined } : item,
                ),
              })
            }
          >
            Clear segment regions
          </button>
        </fieldset>
      )}
      {landmark && waypoint && (
        <fieldset key={landmark.id}>
          <legend>Natural landmark · {landmark.name}</legend>
          <label>
            Landmark name
            <input
              defaultValue={landmark.name}
              maxLength={240}
              onBlur={(event) => updateLandmark({ name: event.target.value.trim() || landmark.name })}
            />
          </label>
          <label>
            Guidance
            <textarea
              defaultValue={landmark.guidance}
              maxLength={240}
              onBlur={(event) => updateLandmark({ guidance: event.target.value.trim() || landmark.guidance })}
            />
          </label>
          {references(false)}
          {references(true)}
          <label>
            Consistent frames needed
            <input
              type="number"
              min="2"
              max="5"
              value={landmark.minimumFrames}
              onChange={(event) => updateLandmark({ minimumFrames: Number(event.target.value) })}
            />
          </label>
          <label>
            Landmark fallback
            <select
              value={landmark.fallback.mode}
              onChange={(event) =>
                updateLandmark({
                  fallback: {
                    mode: event.target.value as Landmark["fallback"]["mode"],
                    ...(event.target.value === "ALTERNATE_WAYPOINT"
                      ? {
                          alternateWaypointId: definition.waypoints.find(
                            (item) => item.id !== waypoint.id && item.worldspaceId === worldspace.id,
                          )?.id,
                        }
                      : {}),
                  },
                })
              }
            >
              <option value="PLAYER" disabled={!waypoint.evidenceProfile.allowManualFallback}>
                Player confirmation
              </option>
              <option value="CAPTAIN" disabled={!waypoint.evidenceProfile.allowCaptainOverride}>
                Captain confirmation
              </option>
              <option
                value="ALTERNATE_WAYPOINT"
                disabled={
                  !definition.waypoints.some((item) => item.id !== waypoint.id && item.worldspaceId === worldspace.id)
                }
              >
                Alternate waypoint
              </option>
              {waypoint.sequence.optional && <option value="NONE">None (optional landmark)</option>}
            </select>
          </label>
          {landmark.fallback.mode === "ALTERNATE_WAYPOINT" && (
            <label>
              Alternate waypoint
              <select
                value={landmark.fallback.alternateWaypointId ?? ""}
                onChange={(event) =>
                  updateLandmark({ fallback: { mode: "ALTERNATE_WAYPOINT", alternateWaypointId: event.target.value } })
                }
              >
                {definition.waypoints
                  .filter((item) => item.id !== waypoint.id && item.worldspaceId === worldspace.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Landmark privacy
            <select
              value={landmark.privacyClassification}
              onChange={(event) =>
                updateLandmark({ privacyClassification: event.target.value as Landmark["privacyClassification"] })
              }
            >
              {privacy.map((item) => (
                <option key={item} value={item}>
                  {readable(item)}
                </option>
              ))}
            </select>
          </label>
          <p>
            Recognition availability is reported during play. References prepare recognition; they do not prove the
            provider is configured.
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...definition,
                context: { ...context, landmarks: context.landmarks.filter((item) => item.id !== landmark.id) },
                waypoints: definition.waypoints.map((item) =>
                  item.id === waypoint.id ? { ...item, landmarkId: undefined } : item,
                ),
              })
            }
          >
            Remove landmark association
          </button>
        </fieldset>
      )}
    </section>
  );
}

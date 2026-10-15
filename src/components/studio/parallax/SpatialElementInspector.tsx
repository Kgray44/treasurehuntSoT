"use client";
import type { SpatialEntity } from "@/parallax/contracts";
import { spatialElementSchema, type SpatialElement } from "@/parallax/element-contracts";
import { physicalAssets } from "@/parallax/asset-catalog";
import styles from "./SpatialStudio.module.css";

export function SpatialElementInspector({
  entity,
  onChange,
}: {
  entity: SpatialEntity;
  onChange: (element: SpatialElement) => void;
}) {
  const e = entity.element;
  if (!e) return null;
  const patch = (values: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...e, ...values };
    for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
    const parsed = spatialElementSchema.safeParse(merged);
    if (parsed.success) onChange(parsed.data);
  };
  const number = (key: string, label: string, min: number, max: number, step = 0.01) => (
    <label key={key}>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number((e as Record<string, unknown>)[key])}
        onChange={(event) => patch({ [key]: Number(event.target.value) })}
      />
    </label>
  );
  const select = (key: string, label: string, options: readonly string[]) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={String((e as Record<string, unknown>)[key])}
        onChange={(event) => patch({ [key]: event.target.value })}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  const descriptor = e.kind === "PHYSICAL_ASSET" ? physicalAssets.find((a) => a.id === e.modelId) : null;
  return (
    <section aria-label="Spatial element properties" className={styles.elementProperties}>
      <h3>{e.kind.replaceAll("_", " ")}</h3>
      <label>
        <input type="checkbox" checked={e.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
        Element enabled
      </label>
      {"color" in e && (
        <label>
          Element color
          <input
            aria-label="Element color"
            type="color"
            value={e.color}
            onChange={(event) => patch({ color: event.target.value })}
          />
        </label>
      )}
      {e.kind === "PHYSICAL_ASSET" && descriptor && (
        <>
          <p>{descriptor.description}</p>
          <small>
            {descriptor.dimensions.join(" × ")} m · bottom-center pivot · {descriptor.support.toLowerCase()} support ·{" "}
            {descriptor.collision.toLowerCase().replaceAll("_", " ")} collision proxy
          </small>
          <small>
            AI-assisted original geometry · Voyagewright proprietary license · owner authorization required for
            redistribution.
          </small>
          {descriptor.articulation &&
            descriptor.articulation !== "CLOTH" &&
            number("articulation", "Articulation", 0, 1)}
          {descriptor.articulation === "CLOTH" && (
            <small>Cloth is an authored stable drape. Live cloth simulation is unavailable.</small>
          )}
        </>
      )}
      {e.kind === "LIGHT" && (
        <>
          {select("type", "Light type", ["POINT", "SPOT", "AMBIENT"])}
          {number("intensity", "Light intensity", 0, 100, 0.1)}
          {e.type !== "AMBIENT" && (
            <>
              {number("range", "Light range in meters", 0.1, 20, 0.1)}
              {number("decay", "Light falloff", 0, 2, 0.1)}
            </>
          )}
          {e.type === "SPOT" && (
            <>
              {number("angle", "Spot angle in radians", 0.05, Math.PI / 2)}
              {number("penumbra", "Spot softness", 0, 1)}
              <small>Aims along local −Z. Use the rotation tool or numeric quaternion to set direction.</small>
            </>
          )}
          {e.type === "AMBIENT" && (
            <small>Ambient light fills the entire scene; position and range have no effect.</small>
          )}
          {number("pulseHz", "Light pulse frequency", 0, 2, 0.05)}
        </>
      )}
      {e.kind === "ATMOSPHERE" && (
        <>
          {number("density", "Mist density", 0, 0.08, 0.001)}
          {number("radius", "Mist radius in meters", 0.1, 5)}
          <small>Layered local mist. No volumetric light scattering.</small>
        </>
      )}
      {e.kind === "PARTICLES" && (
        <>
          {select("style", "Particle style", ["MAGIC", "EMBERS", "DUST"])}
          {number("count", "Particle count", 1, 512, 1)}
          {number("radius", "Particle radius in meters", 0.05, 3)}
          {number("speed", "Particle speed", 0, 2)}
          {number("size", "Particle size in meters", 0.005, 0.1, 0.005)}
          {number("seed", "Particle seed", 1, 65535, 1)}
        </>
      )}
      {e.kind === "PROJECTED_EFFECT" && (
        <>
          {select("pattern", "Projection pattern", ["SYMBOL", "FOOTPRINTS", "WRITING"])}
          {number("opacity", "Projection opacity", 0, 1)}
          <small>
            Surface overlay: place near the surface and rotate to align. Writing uses the object’s clue text.
            Occlusion-aware projection is unavailable.
          </small>
        </>
      )}
      {e.kind === "SPATIAL_AUDIO" && (
        <>
          {select("sound", "Synthesized ambience", ["ETHER", "WIND", "HUM"])}
          {number("gain", "Audio gain", 0, 0.3)}
          {number("refDistance", "Audio reference distance", 0.1, 5)}
          {number("maxDistance", "Audio maximum distance", 1, 20)}
          {number("rolloff", "Audio rolloff", 0, 4)}
          <small>
            Enable preview audio, then play a non-Editor simulation. Pause, mute, background and unmount stop sound. No
            recorded voice is included.
          </small>
        </>
      )}
      {e.kind === "SPATIAL_PHENOMENON" && (
        <>
          {select("style", "Phenomenon style", ["PORTAL", "REVEAL"])}
          {number("speed", "Phenomenon speed", 0, 2)}
        </>
      )}
      {e.kind === "INTERACTION_VOLUME" && (
        <>
          {select("shape", "Region shape", ["BOX", "SPHERE"])}
          {number("radius", "Region radius in meters", 0.05, 3)}
          <small>
            Editor region / grouping pivot. Automatic proximity detection requires a qualified runtime and is
            unavailable.
          </small>
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={Boolean(e.playback)}
          onChange={(event) =>
            patch({
              playback: event.target.checked
                ? { startMs: 0, durationMs: 60000, fadeInMs: 2000, fadeOutMs: 1000, loop: false }
                : undefined,
            })
          }
        />
        Animate element entrance
      </label>
      {e.playback && (
        <>
          {(
            [
              ["startMs", "Element start milliseconds", 0, 60000],
              ["durationMs", "Element duration milliseconds", 1, 60000],
              ["fadeInMs", "Element fade in milliseconds", 0, 10000],
              ["fadeOutMs", "Element fade out milliseconds", 0, 10000],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                aria-label={label}
                min={min}
                max={max}
                step={100}
                value={e.playback![key]}
                onChange={(event) => patch({ playback: { ...e.playback, [key]: Number(event.target.value) } })}
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={e.playback.loop}
              onChange={(event) => patch({ playback: { ...e.playback, loop: event.target.checked } })}
            />
            Loop element animation
          </label>
          <small>
            The existing simulation playhead controls this envelope and opens supported joints from closed to the
            authored articulation. Editor shows the enabled authored pose; reduced motion retains a stable effect.
          </small>
        </>
      )}
      <small>
        Web Studio preview supported. Player/native presentation currently uses the authored Guided alternative.
      </small>
    </section>
  );
}

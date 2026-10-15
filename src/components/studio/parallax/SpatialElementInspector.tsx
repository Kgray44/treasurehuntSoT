"use client";
import type { SpatialEntity } from "@/parallax/contracts";
import { spatialElementSchema, type SpatialElement } from "@/parallax/element-contracts";
import { physicalAssets } from "@/parallax/asset-catalog";
import { InspectorNumber, InspectorRange } from "./InspectorControls";
import styles from "./SpatialStudio.module.css";

export function SpatialElementInspector({
  entity,
  onChange,
  mode,
}: {
  entity: SpatialEntity;
  onChange: (element: SpatialElement) => void;
  mode: "GUIDED" | "DETAILED" | "ENGINEERING";
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
    <InspectorNumber
      key={key}
      label={label}
      value={Number((e as Record<string, unknown>)[key])}
      min={min}
      max={max}
      step={step}
      onCommit={(value) => patch({ [key]: value })}
    />
  );
  const range = (key: string, label: string, min: number, max: number, step: number) => (
    <InspectorRange
      key={key}
      label={label}
      value={Number((e as Record<string, unknown>)[key])}
      min={min}
      max={max}
      step={step}
      onCommit={(value) => patch({ [key]: value })}
    />
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
  const standard = mode !== "GUIDED";
  const engineering = mode === "ENGINEERING";
  return (
    <section aria-label="Spatial element properties" className={styles.elementProperties}>
      <h3>{e.kind.replaceAll("_", " ")}</h3>
      <p className={styles.elementLead}>
        {e.kind === "LIGHT" ? "Light & illumination" : e.kind === "SPATIAL_AUDIO" ? "Sound & reach" :
          e.kind === "INTERACTION_VOLUME" ? "Interaction region" : "Appearance & playback"}
      </p>
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
          {descriptor.visualBlocker && <p role="alert">Preview only: {descriptor.visualBlocker}</p>}
          <p>{descriptor.description}</p>
          {engineering && <small>
            {descriptor.dimensions.join(" × ")} m · bottom-center pivot · {descriptor.support.toLowerCase()} support ·{" "}
            {descriptor.collision.toLowerCase().replaceAll("_", " ")} collision proxy
          </small>}
          {engineering && <small>
            AI-assisted original geometry · Voyagewright proprietary license · owner authorization required for
            redistribution.
          </small>}
          {descriptor.articulation && descriptor.articulation !== "CLOTH" &&
            range("articulation", "Articulation", 0, 1, 0.01)}
          {descriptor.articulation === "CLOTH" && (
            <small>Cloth is an authored stable drape. Live cloth simulation is unavailable.</small>
          )}
        </>
      )}
      {e.kind === "LIGHT" && (
        <>
          {select("type", "Light type", ["POINT", "SPOT", "AMBIENT"])}
          {range("intensity", "Light intensity", 0, 100, 0.1)}
          {e.type !== "AMBIENT" && (
            <>
              {number("range", "Light range in meters", 0.1, 20, 0.1)}
              {standard && number("decay", "Light falloff", 0, 2, 0.1)}
            </>
          )}
          {e.type === "SPOT" && (
            <>
              {standard && number("angle", "Spot angle in radians", 0.05, Math.PI / 2)}
              {standard && number("penumbra", "Spot softness", 0, 1)}
              {engineering && <small>Aims along local −Z. Use Rotate in scene, or numeric pitch, yaw and roll to set direction.</small>}
            </>
          )}
          {e.type === "AMBIENT" && (
            <small>Ambient light fills the entire scene; position and range have no effect.</small>
          )}
          {standard && number("pulseHz", "Light pulse frequency", 0, 2, 0.05)}
        </>
      )}
      {e.kind === "ATMOSPHERE" && (
        <>
          {range("density", "Mist density", 0, 0.08, 0.001)}
          {number("radius", "Mist radius in meters", 0.1, 5)}
          {engineering && <small>Layered local mist. No volumetric light scattering.</small>}
        </>
      )}
      {e.kind === "PARTICLES" && (
        <>
          {select("style", "Particle style", ["MAGIC", "EMBERS", "DUST"])}
          {range("count", "Particle count", 1, 512, 1)}
          {number("radius", "Particle radius in meters", 0.05, 3)}
          {standard && number("speed", "Particle speed", 0, 2)}
          {standard && number("size", "Particle size in meters", 0.005, 0.1, 0.005)}
          {engineering && number("seed", "Particle seed", 1, 65535, 1)}
        </>
      )}
      {e.kind === "PROJECTED_EFFECT" && (
        <>
          {select("pattern", "Projection pattern", ["SYMBOL", "FOOTPRINTS", "WRITING"])}
          {range("opacity", "Projection opacity", 0, 1, 0.01)}
          {engineering && <small>
            Surface overlay: place near the surface and rotate to align. Writing uses the object’s clue text.
            Occlusion-aware projection is unavailable.
          </small>}
        </>
      )}
      {e.kind === "SPATIAL_AUDIO" && (
        <>
          {select("sound", "Synthesized ambience", ["ETHER", "WIND", "HUM"])}
          {range("gain", "Audio gain", 0, 0.3, 0.01)}
          {standard && number("refDistance", "Audio reference distance", 0.1, 5)}
          {standard && number("maxDistance", "Audio maximum distance", 1, 20)}
          {engineering && number("rolloff", "Audio rolloff", 0, 4)}
          <small>
            Enable preview audio, then play a non-Editor simulation. Pause, mute, background and unmount stop sound. No
            recorded voice is included.
          </small>
        </>
      )}
      {e.kind === "SPATIAL_PHENOMENON" && (
        <>
          {select("style", "Phenomenon style", ["PORTAL", "REVEAL"])}
          {standard && number("speed", "Phenomenon speed", 0, 2)}
        </>
      )}
      {e.kind === "INTERACTION_VOLUME" && (
        <>
          {select("shape", "Region shape", ["BOX", "SPHERE"])}
          {number("radius", "Region radius in meters", 0.05, 3)}
          {engineering && <small>
            Editor region / grouping pivot. Automatic proximity detection requires a qualified runtime and is
            unavailable.
          </small>}
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
      {e.playback && standard && (
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
      {engineering && <small>
        Web Studio preview supported. Player/native presentation currently uses the authored Guided alternative.
      </small>}
    </section>
  );
}

"use client";
import { useState } from "react";
import { draftSchema, type SpatialDraft } from "@/parallax/authoring";
import { emptyStudioContent } from "@/parallax/studio-contracts";
export function SpatialDependencies({
  draft,
  entityId,
  onChange,
}: {
  draft: SpatialDraft;
  entityId: string;
  onChange: (draft: SpatialDraft) => void;
}) {
  const [waypoint, setWaypoint] = useState(""),
    [version, setVersion] = useState(""),
    [checksum, setChecksum] = useState(""),
    [asset, setAsset] = useState(""),
    [error, setError] = useState("");
  return (
    <section>
      <h3>Vision Waypoint reference</h3>
      <p>Sibling-library reference only. Recognition stays Watchglass-owned.</p>
      <label>
        Vision Waypoint ID
        <input value={waypoint} onChange={(e) => setWaypoint(e.target.value)} />
      </label>
      <label>
        Waypoint version ID
        <input value={version} onChange={(e) => setVersion(e.target.value)} />
      </label>
      <label>
        Waypoint checksum
        <input value={checksum} onChange={(e) => setChecksum(e.target.value)} maxLength={64} />
      </label>
      <button
        disabled={!waypoint || !version || checksum.length !== 64}
        onClick={() => {
          try {
            const next = structuredClone(draft);
            next.content.studio ??= emptyStudioContent();
            next.content.studio.visionReferences.push({
              entityId,
              waypointId: waypoint,
              versionId: version,
              checksum,
              purpose: "RELOCALIZATION",
            });
            onChange(draftSchema.parse(next));
            setError("");
          } catch {
            setError("Use a valid exact waypoint version and SHA-256 checksum.");
          }
        }}
      >
        Pin Vision Waypoint reference
      </button>
      {draft.content.studio?.visionReferences.map((r, i) => (
        <p key={`${r.entityId}:${r.versionId}:${i}`}>
          {r.waypointId} @ {r.versionId}
          <button
            onClick={() => {
              const next = structuredClone(draft);
              next.content.studio!.visionReferences.splice(i, 1);
              onChange(next);
            }}
          >
            Remove reference
          </button>
        </p>
      ))}
      <h3>Asset dependency validation</h3>
      <p>
        Built-in parchment, marker and text render everywhere. Imported media is validated here; its renderer remains a
        separate compatibility gate.
      </p>
      <label>
        Asset manifest
        <textarea
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          placeholder='{"id":"asset","entityId":"…","kind":"MODEL","assetId":"…","checksum":"…","format":"GLB","bytes":1000,"triangles":100,"texturePixels":0,"durationSeconds":0,"metersPerUnit":1,"alternativeText":"…","license":"Creator owned","provenance":"CREATOR"}'
        />
      </label>
      <button
        disabled={!asset}
        onClick={() => {
          try {
            const next = structuredClone(draft);
            next.content.studio ??= emptyStudioContent();
            next.content.studio.assets.push({ ...JSON.parse(asset), entityId });
            onChange(draftSchema.parse(next));
            setAsset("");
            setError("");
          } catch {
            setError(
              "The manifest must contain only the typed asset, checksum, scale, complexity, license and accessibility fields.",
            );
          }
        }}
      >
        Validate asset manifest
      </button>
      {draft.content.studio?.assets.map((a, i) => (
        <p key={a.id}>
          {a.kind}: {a.assetId} · {a.metersPerUnit} meters/unit
          <button
            onClick={() => {
              const next = structuredClone(draft);
              next.content.studio!.assets.splice(i, 1);
              onChange(next);
            }}
          >
            Remove dependency
          </button>
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

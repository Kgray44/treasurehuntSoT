"use client";
import Link from "next/link";
import { spatialStudioHref } from "@/parallax/studio-validation";
import type { Block } from "@/components/studio/studio-types";
import type { SpatialMoment } from "@/parallax/contracts";
export function SpatialAttachment({
  taleId,
  block,
  onChange,
}: {
  taleId: string;
  block: Block;
  onChange: (mutator: (block: Block) => void) => void;
}) {
  const moment = block.presentation.spatialMoment as unknown as SpatialMoment | undefined;
  const query = new URLSearchParams({ chronicle: taleId, block: block.id });
  return (
    <section className="inspector-section" aria-label="Spatial Moment attachment">
      <h3>Spatial Moment</h3>
      {moment ? (
        <>
          <p>
            {moment.version.title} · v{moment.version.semanticVersion}
          </p>
          <small>Exact version pinned. Chronicle completion keeps its existing rule.</small>
          <Link href={spatialStudioHref(moment.definition.id, undefined, taleId, block.id)}>Edit in Parallax →</Link>
          <label>
            Contextual narrative override
            <textarea
              value={moment.attachment.overrides.narrative ?? ""}
              onChange={(e) =>
                onChange((current) => {
                  const attached = structuredClone(current.presentation.spatialMoment) as unknown as SpatialMoment;
                  attached.attachment.overrides = e.target.value ? { narrative: e.target.value } : {};
                  current.presentation.spatialMoment = attached as unknown as typeof current.presentation.spatialMoment;
                })
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onChange((current) => {
                delete current.presentation.spatialMoment;
              })
            }
          >
            Detach from this draft
          </button>
        </>
      ) : (
        <>
          <p>Choose a reusable experience or build one in the full Spatial Studio.</p>
          <Link href={`/studio/parallax?${query}`}>Add Spatial Moment →</Link>
        </>
      )}
    </section>
  );
}

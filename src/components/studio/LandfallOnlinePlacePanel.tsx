"use client";
import { LandfallOnlineDataControls } from "@/components/player/journal/LandfallOnlineDataPanel";
import type { LandfallWorldspace } from "@/landfall/schema";
import type { RemotePlace } from "@/landfall/remote-data";

export function LandfallOnlinePlacePanel({
  taleId,
  sourceVersion,
  csrfToken,
  worldspace,
  unsaved,
  onSelectPlace,
}: {
  taleId: string;
  sourceVersion: number;
  csrfToken: string;
  worldspace: LandfallWorldspace;
  unsaved: boolean;
  onSelectPlace: (place: RemotePlace) => void;
}) {
  if (
    worldspace.kind !== "PHYSICAL" ||
    !["PUBLIC_REAL_WORLD", "GENERIC"].includes(worldspace.privacyPolicy.classification)
  )
    return null;
  if (unsaved) return <p>Save your chart before checking online place options.</p>;
  const key = JSON.stringify([taleId, sourceVersion, worldspace.id, worldspace.privacyPolicy.classification]);
  return (
    <LandfallOnlineDataControls
      key={key}
      endpoint={`/api/studio/tales/${encodeURIComponent(taleId)}/landfall/data`}
      csrfToken={csrfToken}
      position={null}
      placeSearchOnly
      onSelectPlace={onSelectPlace}
      requestHeaders={{ "x-landfall-worldspace": worldspace.id, "x-landfall-draft-version": String(sourceVersion) }}
    />
  );
}

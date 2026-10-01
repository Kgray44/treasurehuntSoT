"use client";

import type { ContextualSnapshot } from "@/landfall/contextual";
import type { LandfallContextSummary } from "@/landfall/journey-projection";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

/** Guidance deliberately keeps the selected viewing floor separate from local inference. */
export function LandfallContextGuidance({
  bootstrap,
  snapshot,
  historical = false,
  viewingMapId,
  onViewingMapChange,
}: {
  bootstrap: PlayerLandfallBootstrap;
  snapshot: ContextualSnapshot | LandfallContextSummary | null;
  historical?: boolean;
  viewingMapId: string;
  onViewingMapChange: (id: string) => void;
}) {
  if (!bootstrap.runtimeDefinition.context) return null;
  const region = bootstrap.runtimeDefinition.context.regions.find((item) => item.id === snapshot?.regionId);
  const maps = bootstrap.availableMaps ?? [];
  const viewing = maps.find((item) => item.id === viewingMapId);
  const words = (value: string) => value.toLowerCase().replaceAll("_", " ");
  return (
    <section aria-label="Context and floor guidance">
      <p role="status" aria-live="polite">
        {historical ? "Recorded context" : "Local context"}: {snapshot ? words(snapshot.state) : "unavailable"}
        {region ? ` · ${region.name}` : ""}
        {snapshot?.level ? ` · ${historical ? "recorded" : "likely"} level ${snapshot.level}` : ""}.
        {!historical && " Context guides your search; only the Voyage can record arrival."}
      </p>
      {!historical && (
        <p>
          GPS can identify a broad site or building. Rooms, floors and exact objects need independent evidence or the
          configured fallback.
        </p>
      )}
      {maps.length > 1 && (
        <label>
          Viewing map or floor
          <select value={viewingMapId} onChange={(event) => onViewingMapChange(event.target.value)}>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
                {map.level ? ` · ${map.level}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {viewing?.level && (
        <p>Viewing level {viewing.level}. Choosing a map does not establish your location or likely floor.</p>
      )}
      {snapshot && "reasons" in snapshot && snapshot.reasons.length > 0 && (
        <p>{snapshot.reasons.map(words).join(" · ")}</p>
      )}
      {snapshot?.evidenceCategories.length ? (
        <p>Evidence categories: {snapshot.evidenceCategories.map(words).join(", ")}.</p>
      ) : null}
      {snapshot && "fallbackUsed" in snapshot && snapshot.fallbackUsed && (
        <p>Arrival used the configured fallback. No exact sensor location was claimed.</p>
      )}
      {viewing && <p>Viewed map offline: {words(viewing.offlineMap)}.</p>}
    </section>
  );
}

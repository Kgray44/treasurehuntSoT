"use client";

import { useId, useMemo, useState } from "react";
import { ReleasedChartLookupProvider, type ReleasedChartPlace } from "@/landfall/chart-search";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export function LandfallPlaceSearch({
  bootstrap,
  onSelect,
  onClear,
}: {
  bootstrap: PlayerLandfallBootstrap;
  onSelect: (place: ReleasedChartPlace) => void;
  onClear: () => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const provider = useMemo(() => new ReleasedChartLookupProvider(bootstrap), [bootstrap]);
  const places = provider.forward(query);
  return (
    <section aria-label="Search released places">
      <label htmlFor={fieldId}>Find a place on your released maps</label>
      <input
        id={fieldId}
        type="search"
        maxLength={240}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onClear();
        }}
      />
      <p>Search stays on this device. Selecting a place changes your view; it does not confirm arrival.</p>
      {query.trim() && (
        <>
          <p role="status">
            {places.length
              ? `${places.length} matching ${places.length === 1 ? "place" : "places"}.`
              : "No released places match."}
          </p>
          <ul aria-label="Matching released places">
            {places.map((place) => (
              <li key={JSON.stringify([place.mapId, place.id])}>
                <button type="button" onClick={() => onSelect(place)}>
                  View {place.label} · {place.mapName}
                </button>
                {place.precision === "WITHHELD" && <span> · Exact position is withheld.</span>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClear();
            }}
          >
            Clear place search
          </button>
        </>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { presetNames } from "@/parallax/authoring";
import { useStudioContextMenu, StudioIcon } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

export function AssetPreview({ name }: { name: string }) {
  const compass = name.includes("Compass"),
    trail = name.includes("Trail"),
    wall = name.includes("Wall"),
    exclusion = name === "Exclusion Zone";
  return (
    <svg viewBox="0 0 180 105" aria-hidden="true" className={styles.assetArt}>
      <path d="M12 87 90 105 170 86 90 68Z" fill="#162232" />
      {exclusion ? (
        <g fill="#7fb7ef" fillOpacity="0.14" stroke="#8dbcf0" strokeWidth="2" strokeLinejoin="round">
          <path d="M45 35 93 15 139 36 91 57Z M45 35V76L91 96V57 M139 36V76L91 96 M45 76 93 56 139 76 M93 15V56" />
        </g>
      ) : compass ? (
        <g transform="translate(90 47) rotate(-20)">
          <ellipse rx="34" ry="28" fill="#243e4e" stroke="#a6baa9" strokeWidth="4" />
          <path d="m0-24 8 22-8 22-8-22Z" fill="#8be4d4" />
          <path d="M-24 0H24M0-24V24" stroke="#7eabb2" />
        </g>
      ) : trail ? (
        <g fill="#78d4c3">
          {Array.from({ length: 4 }, (_, i) => (
            <g key={i} transform={`translate(${50 + i * 22} ${68 - i * 9}) rotate(-28)`}>
              <ellipse rx="6" ry="12" />
              <circle cy="-16" r="4" />
            </g>
          ))}
        </g>
      ) : (
        <g transform={wall ? "translate(56 13)" : "translate(30 25) rotate(-12 60 30)"}>
          <path
            d={wall ? "M0 0H70V66H0Z" : "M0 0 114 6 120 62 8 59Z"}
            fill={wall ? "#273b4c" : "#d7cbae"}
            stroke="#768a9b"
          />
          <path
            d={name.includes("Map") ? "m12 25 22-12 9 13 25-5 20 23-21 9-27-11-22 6Z" : "M15 16H55M15 27H55M15 38H50"}
            fill="none"
            stroke={wall ? "#99ded6" : "#788274"}
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  );
}
export function SpatialAssetBrowser({
  busy,
  onAdd,
  onNew,
}: {
  busy: boolean;
  onAdd: (name: string) => void;
  onNew: () => void;
}) {
  const contextMenu = useStudioContextMenu();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All");
  const categoryOf = (name: string) =>
    name === "Exclusion Zone"
      ? "Tools"
      : name.includes("Trail")
        ? "Trails"
        : name.includes("Wall")
          ? "Writing"
          : "Objects";
  const names = [...presetNames, "Exclusion Zone"].filter(
    (n) => n.toLowerCase().includes(search.toLowerCase()) && (category === "All" || categoryOf(n) === category),
  );
  return (
    <section className={styles.assetBrowser} aria-label="Spatial asset browser">
      <div className={styles.panelTitle}>
        <h3>Asset browser</h3>
        <button
          aria-label="New scene"
          onClick={onNew}
          disabled={busy}
          title="Save the current draft and open a new spatial moment"
        >
          <StudioIcon name="plus" />
        </button>
      </div>
      <input
        aria-label="Search spatial assets"
        placeholder="Search objects, writing, trails…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className={styles.assetCategories} aria-label="Asset categories">
        {["All", "Objects", "Writing", "Trails", "Tools"].map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className={styles.assetGrid}>
        {names.map((name) => (
          <button
            className={styles.assetCard}
            key={name}
            draggable
            disabled={busy}
            onDragStart={(e) => e.dataTransfer.setData("application/parallax-preset", name)}
            onClick={() => onAdd(name)}
            onContextMenu={(event) =>
              contextMenu.open(event, name, [
                { label: "Add to scene", icon: "plus", disabled: busy, run: () => onAdd(name) },
              ])
            }
            onKeyDown={(event) =>
              contextMenu.open(event, name, [
                { label: "Add to scene", icon: "plus", disabled: busy, run: () => onAdd(name) },
              ])
            }
            title={`Add ${name} to this scene`}
          >
            <AssetPreview name={name} />
            <strong>{name}</strong>
            <small>{categoryOf(name)} · built-in</small>
          </button>
        ))}
      </div>
      {!names.length && <p>No supported assets match this filter.</p>}
      <details className={styles.libraryHelp}>
        <summary>Library help</summary>
        <small>
          Add or drag objects into the viewport. Imported models, effects and portals require a qualified renderer and
          are unavailable in this phase.
        </small>
      </details>
      {contextMenu.menu}
    </section>
  );
}

"use client";

import styles from "./ChronicleAuthoring.module.css";

import { useEffect, useRef } from "react";
import type { Asset, Tale } from "./studio-types";

export function ChronicleDetails({
  tale,
  assets,
  onChange,
  onClose,
  onSave,
  saveState,
}: {
  tale: Tale;
  assets: Asset[];
  onChange: (patch: Partial<Tale>) => void;
  onClose?: () => void;
  onSave: () => void;
  saveState: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      id="chronicle-details"
      className={`editor-single-panel settings-panel ${styles["chronicle-details"]}`}
      aria-labelledby="chronicle-details-heading"
      onKeyDown={(event) => {
        if (event.key === "Escape" && onClose) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Make it yours</p>
          <h2 id="chronicle-details-heading" tabIndex={-1} ref={heading}>
            Chronicle Details
          </h2>
          <p>Shape these details as your story grows. Your draft stays editable while you work.</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close Chronicle Details">
            Close
          </button>
        )}
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="settings-grid">
          <label>
            <span>Title</span>
            <input
              value={tale.title}
              maxLength={160}
              required
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </label>
          <label>
            <span>Address</span>
            <input
              value={tale.slug}
              aria-label="Address"
              aria-describedby="chronicle-address-help"
              minLength={3}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              onChange={(event) => onChange({ slug: event.target.value.toLowerCase() })}
            />
            <small id="chronicle-address-help">
              The published link uses this address. Renaming the title keeps the address.
            </small>
          </label>
          <label>
            <span>Subtitle</span>
            <input
              value={tale.subtitle ?? ""}
              maxLength={240}
              onChange={(event) => onChange({ subtitle: event.target.value })}
            />
          </label>
          <label>
            <span>Theme</span>
            <select value={tale.theme} onChange={(event) => onChange({ theme: event.target.value })}>
              {!["CARTOGRAPHERS_TABLE", "MOONLIT_JOURNAL", "CAPTAINS_CABIN"].includes(tale.theme) && (
                <option value={tale.theme}>{tale.theme}</option>
              )}
              <option value="CARTOGRAPHERS_TABLE">Cartographer’s Table</option>
              <option value="MOONLIT_JOURNAL">Moonlit Journal</option>
              <option value="CAPTAINS_CABIN">Captain’s Cabin</option>
            </select>
          </label>
          <label className="wide">
            <span>Short description</span>
            <textarea
              value={tale.shortDescription ?? ""}
              maxLength={600}
              rows={3}
              onChange={(event) => onChange({ shortDescription: event.target.value })}
            />
          </label>
          <label className="wide">
            <span>Long description</span>
            <textarea
              value={tale.longDescription ?? ""}
              maxLength={20000}
              rows={6}
              onChange={(event) => onChange({ longDescription: event.target.value })}
            />
          </label>
          <label>
            <span>Minimum players</span>
            <input
              type="number"
              min={1}
              max={20}
              value={tale.playerCountMin}
              onChange={(event) => onChange({ playerCountMin: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Maximum players</span>
            <input
              type="number"
              min={1}
              max={20}
              value={tale.playerCountMax}
              onChange={(event) => onChange({ playerCountMax: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Estimated minutes</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={tale.estimatedDuration ?? ""}
              onChange={(event) =>
                onChange({ estimatedDuration: event.target.value ? Number(event.target.value) : null })
              }
            />
          </label>
          <label>
            <span>Visibility</span>
            <select value={tale.visibility} onChange={(event) => onChange({ visibility: event.target.value })}>
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted after publishing</option>
              <option value="PUBLIC">Public after publishing</option>
            </select>
          </label>
          <label>
            <span>Cover asset</span>
            <select
              value={tale.coverAssetId ?? ""}
              aria-label="Cover asset"
              aria-describedby="chronicle-cover-help"
              onChange={(event) => onChange({ coverAssetId: event.target.value || null })}
            >
              <option value="">No cover</option>
              {assets
                .filter((asset) => asset.mediaType === "IMAGE")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.displayName}
                  </option>
                ))}
            </select>
            <small id="chronicle-cover-help">Upload cover imagery through the editor’s Assets section.</small>
          </label>
          <label className="wide">
            <span>Content warnings</span>
            <textarea
              value={tale.contentWarnings ?? ""}
              maxLength={4000}
              rows={3}
              onChange={(event) => onChange({ contentWarnings: event.target.value })}
            />
          </label>
        </div>
        <footer>
          <button type="submit" className="brass-button">
            Save details
          </button>
          <span role="status" aria-live="polite">
            {saveState}
          </span>
        </footer>
      </form>
    </section>
  );
}

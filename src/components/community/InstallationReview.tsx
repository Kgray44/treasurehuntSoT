"use client";

import { useId, useState } from "react";

export type InstallationMode = "LIBRARY_REFERENCE" | "EDITABLE_COPY" | "FORK" | "IMPORT_INTO_DRAFT" | "PREVIEW_SANDBOX";
const labels: Record<InstallationMode, string> = {
  LIBRARY_REFERENCE: "Reusable library reference",
  EDITABLE_COPY: "Editable copy",
  FORK: "Fork with lineage",
  IMPORT_INTO_DRAFT: "Import into current Tale draft",
  PREVIEW_SANDBOX: "Preview sandbox (no changes)",
};

export function InstallationReview({
  allowedModes,
  obligations = [],
  warnings = [],
  localEditProtected = false,
  onInstall,
}: {
  allowedModes: InstallationMode[];
  obligations?: string[];
  warnings?: string[];
  localEditProtected?: boolean;
  onInstall: (mode: InstallationMode) => void | Promise<void>;
}) {
  const groupId = useId();
  const [mode, setMode] = useState<InstallationMode | undefined>(allowedModes[0]);
  const [complete, setComplete] = useState(false);
  const canInstall = Boolean(mode) && !(localEditProtected && mode === "LIBRARY_REFERENCE");
  return (
    <section aria-labelledby="community-install-heading">
      <h2 id="community-install-heading">Review installation</h2>
      <p aria-live="polite">
        {localEditProtected
          ? "Local changes are protected; choose an editable copy or fork."
          : "Choose how this package should be installed."}
      </p>
      <fieldset>
        <legend id={groupId}>Installation mode</legend>
        {allowedModes.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={groupId}
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
            />{" "}
            {labels[option]}
          </label>
        ))}
      </fieldset>
      {obligations.length > 0 ? (
        <section aria-labelledby="community-install-obligations">
          <h3 id="community-install-obligations">Attribution and licence obligations</h3>
          <ul>
            {obligations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {warnings.length > 0 ? (
        <section aria-labelledby="community-install-warnings" role="status">
          <h3 id="community-install-warnings">Review before continuing</h3>
          <ul>
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <button
        type="button"
        disabled={!canInstall}
        onClick={async () => {
          if (mode && canInstall) {
            await onInstall(mode);
            setComplete(true);
          }
        }}
      >
        {mode === "PREVIEW_SANDBOX" ? "Open preview sandbox" : "Install selected mode"}
      </button>
      {complete ? (
        <p role="status">
          {mode === "PREVIEW_SANDBOX"
            ? "Preview sandbox opened. No content was installed."
            : "Installation request submitted. Your receipt will preserve attribution and lineage."}
        </p>
      ) : null}
    </section>
  );
}

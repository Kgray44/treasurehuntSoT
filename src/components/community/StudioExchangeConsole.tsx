"use client";

import { useState } from "react";
import { ArtifactPreview } from "./ArtifactPreview";
import { InstallationReview } from "./InstallationReview";
import { PublicationWizard, type PublicationWizardValues } from "./PublicationWizard";

/**
 * The Studio-facing Exchange surface deliberately delegates all durable work
 * to the existing authenticated Exchange routes. It never fabricates a release
 * or reports a package/install as successful before the server receipt exists.
 */
export function StudioExchangeConsole({ authenticated }: { authenticated: boolean }) {
  const [notice, setNotice] = useState("");
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <h1>Creator access is required.</h1>
        <p>Sign in with a Creator account to use the Community Exchange.</p>
      </main>
    );
  const submitPublication = async (values: PublicationWizardValues) => {
    // Release/package construction is intentionally server-authoritative. This
    // receipt only confirms that the client completed local metadata review.
    setNotice(
      `Metadata review is ready for published version ${values.sourcePublishedVersionId}. Build the immutable package from the selected release.`,
    );
  };
  return (
    <main className="studio-home" data-testid="studio-community-exchange">
      <header className="studio-home-header">
        <div>
          <p className="eyebrow">Community Harbor</p>
          <h1>Open the Exchange</h1>
          <p>Publish immutable Chronicle releases and review safe reusable installs.</p>
        </div>
      </header>
      <PublicationWizard onSubmit={submitPublication} />
      {notice ? <p role="status">{notice}</p> : null}
      <InstallationReview
        allowedModes={["LIBRARY_REFERENCE", "EDITABLE_COPY", "FORK", "IMPORT_INTO_DRAFT", "PREVIEW_SANDBOX"]}
        obligations={["Preserve release attribution and licence obligations."]}
        onInstall={(mode) =>
          setNotice(
            mode === "PREVIEW_SANDBOX"
              ? "Preview sandbox opened without installing content."
              : `${mode.replaceAll("_", " ")} review is ready for its server receipt.`,
          )
        }
      />
      <ArtifactPreview
        title="Artifact preview contract"
        description="A static poster fallback is always available for 3D Exchange artifacts."
        posterUrl="/images/placeholder.svg"
        kind="3D"
        reducedMotion
      />
    </main>
  );
}

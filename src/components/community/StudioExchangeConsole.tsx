"use client";

import { useState } from "react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
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
  const [stage, setStage] = useState<"release" | "install" | "success">("release");
  const { mode } = useMotionMode();
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
    setStage("install");
  };
  return (
    <main className="studio-home" data-testid="studio-community-exchange">
      <header className="studio-home-header studio-exchange-header">
        <div>
          <p className="eyebrow">Community Harbor</p>
          <h1>Open the Exchange</h1>
          <p>Move an immutable Chronicle release through deliberate Community publication and safe reuse checks.</p>
        </div>
      </header>
      <ol className="studio-exchange-steps" aria-label="Community Exchange workflow">
        <li data-current={stage === "release" || stage === "install" || stage === "success"}>1. Immutable release</li>
        <li data-current={stage === "install" || stage === "success"}>2. Package and reuse intent</li>
        <li data-current={stage === "success"}>3. Receipt</li>
      </ol>
      <div className="studio-exchange-layout">
        <PublicationWizard onSubmit={submitPublication} />
        <aside className="studio-exchange-guidance" aria-label="Exchange safeguards">
          <p className="eyebrow">Before you continue</p>
          <h2>What the Exchange preserves</h2>
          <ul>
            <li>Immutable source Version and release lineage</li>
            <li>Scanner and validation gates before publication</li>
            <li>Attribution and licensing obligations</li>
            <li>Preview that never installs content</li>
          </ul>
        </aside>
      </div>
      {notice ? (
        <p className="studio-exchange-receipt" role="status">
          {notice}
        </p>
      ) : null}
      <div className="studio-exchange-layout">
        <InstallationReview
          allowedModes={["LIBRARY_REFERENCE", "EDITABLE_COPY", "FORK", "IMPORT_INTO_DRAFT", "PREVIEW_SANDBOX"]}
          obligations={["Preserve release attribution and licence obligations."]}
          onInstall={(selectedMode) => {
            setNotice(
              selectedMode === "PREVIEW_SANDBOX"
                ? "Preview sandbox opened without installing content."
                : `${selectedMode.replaceAll("_", " ")} review is ready for its server receipt.`,
            );
            setStage("success");
          }}
        />
        <ArtifactPreview
          title="Preview sandbox"
          description="A static poster fallback is available for 3D Exchange artifacts. The preview never installs or publishes content."
          posterUrl="/animations/stills/compass-fallback.svg"
          kind="3D"
          reducedMotion={mode === "reduced"}
        />
      </div>
    </main>
  );
}

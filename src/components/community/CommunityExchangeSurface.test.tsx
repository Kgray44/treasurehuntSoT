import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactPreview } from "./ArtifactPreview";
import { InstallationReview } from "./InstallationReview";
import { PublicationWizard } from "./PublicationWizard";

describe("Community Exchange surfaces", () => {
  afterEach(cleanup);
  it("blocks publication until immutable source, accessibility, licence, and clean scan are present", () => {
    const submit = vi.fn();
    render(<PublicationWizard onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish release" }));
    expect(screen.getByRole("alert")).toHaveTextContent("immutable published Chronicle version");
    expect(submit).not.toHaveBeenCalled();
  });

  it("protects local changes from linked installation and records a selected editable mode", async () => {
    const install = vi.fn();
    render(
      <InstallationReview
        allowedModes={["LIBRARY_REFERENCE", "EDITABLE_COPY", "FORK"]}
        localEditProtected
        onInstall={install}
      />,
    );
    expect(screen.getByRole("button", { name: "Install selected mode" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Editable copy" }));
    fireEvent.click(screen.getByRole("button", { name: "Install selected mode" }));
    expect(install).toHaveBeenCalledWith("EDITABLE_COPY");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Installation request submitted"));
  });

  it("offers keyboard-operated 3D controls and a truthful reduced-motion fallback", () => {
    const { rerender } = render(
      <ArtifactPreview title="Compass" description="A brass compass." posterUrl="/compass.png" kind="3D" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    expect(screen.getByRole("status")).toHaveTextContent("15 degrees");
    rerender(
      <ArtifactPreview
        title="Compass"
        description="A brass compass."
        posterUrl="/compass.png"
        kind="3D"
        reducedMotion
      />,
    );
    expect(screen.queryByRole("button", { name: "Rotate right" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("static poster");
  });
});

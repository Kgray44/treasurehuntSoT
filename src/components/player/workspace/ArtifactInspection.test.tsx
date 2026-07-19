import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicArtifact } from "@/domain/story";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHost } from "@/animation/hosts/SceneHost";
import { ArtifactInspection, type ArtifactInspectionTargetHandles } from "./ArtifactInspection";

const artifact: PublicArtifact = {
  key: "development-compass",
  state: "AWARDED",
  name: "Development Compass",
  category: "NAVIGATION",
  description: "A safe test relic.",
  discoveryText: "Its needle follows the released truth.",
  displayX: 50,
  displayY: 50,
  unseen: false,
};

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

function CaptureGatedInspectionShell({ onCapture }: { onCapture: (node: HTMLElement) => void }) {
  useLayoutEffect(() => {
    const node = document.querySelector<HTMLElement>("[data-artifact-target-role='layout-destination']");
    if (node?.dataset.runtimeLease === "gated") onCapture(node);
  }, [onCapture]);

  return null;
}

describe("ArtifactInspection animation boundary", () => {
  it("traps focus, closes with Escape, and returns focus to the exact connected trigger", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);

    function Harness() {
      const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
      const [open, setOpen] = useState(false);
      return (
        <AnimationProvider>
          <button ref={setTrigger} onClick={() => setOpen(true)}>
            Inspect relic
          </button>
          <AnimatePresence>
            {open && <ArtifactInspection artifact={artifact} close={() => setOpen(false)} restoreFocus={trigger} />}
          </AnimatePresence>
        </AnimationProvider>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Inspect relic" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole("button", { name: "Close inspection" });
    expect(closeButton).toHaveFocus();
    outside.focus();
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Inspect relic" })).toHaveFocus();
    outside.remove();
  });

  it("uses the boxed dialog as its local host and keeps Motion layout separate from GSAP detail targets", async () => {
    const changes: Array<ArtifactInspectionTargetHandles | null> = [];
    let gatedLayoutShell: HTMLElement | null = null;
    const { unmount } = render(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="inspection-test-parent">
          <ArtifactInspection
            artifact={artifact}
            close={vi.fn()}
            restoreFocus={null}
            onTargetHandlesChange={(handles) => changes.push(handles)}
          />
          <CaptureGatedInspectionShell onCapture={(node) => (gatedLayoutShell = node)} />
        </SceneHost>
      </AnimationProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: artifact.name });
    const localHost = dialog as HTMLElement;
    const motionWrapper = localHost.parentElement;
    expect(localHost.tagName).toBe("SECTION");
    expect(localHost).toHaveClass("artifact-inspection");
    expect(localHost).toHaveAttribute("data-scene-host-boundary", "player-section-enhancement");
    expect(localHost).toHaveAttribute("aria-modal", "true");
    expect(localHost).not.toHaveStyle({ display: "contents" });
    expect(localHost).toHaveStyle({ minWidth: "1px", minHeight: "1px" });
    expect(motionWrapper).toHaveAttribute("data-artifact-inspection-motion-wrapper");
    expect(motionWrapper).toHaveAttribute("data-runtime-boundary", "motion");

    const layoutShell = dialog.querySelector<HTMLElement>("[data-artifact-target-role='layout-destination']")!;
    const engraving = dialog.querySelector<HTMLElement>("[data-artifact-target-role='engraving']")!;
    const returnVisual = dialog.querySelector<HTMLElement>("[data-artifact-target-role='return-visual']")!;
    const detailLight = dialog.querySelector<HTMLElement>("[data-artifact-target-role='detail-light']")!;
    const story = dialog.querySelector<HTMLElement>("[data-static-readable='true']")!;
    const connectedGatedLayoutShell = gatedLayoutShell as HTMLElement | null;

    for (const target of [layoutShell, engraving, returnVisual, detailLight]) {
      expect(localHost).toContainElement(target);
      expect(target.closest("[data-scene-host-boundary]")).toBe(localHost);
    }

    expect(layoutShell).toHaveAttribute("data-runtime-boundary", "motion");
    expect(layoutShell).toHaveAttribute("data-runtime-lease", "ready");
    expect(layoutShell).toHaveAttribute("data-shared-layout-id", `artifact-${artifact.key}`);
    expect(connectedGatedLayoutShell).toBe(layoutShell);
    expect(connectedGatedLayoutShell?.isConnected).toBe(true);
    expect(layoutShell).not.toHaveAttribute("data-gsap-owned");
    expect(layoutShell).toContainElement(engraving);
    expect(engraving).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(engraving).toHaveAttribute("aria-hidden", "true");
    expect(engraving).toHaveStyle({ pointerEvents: "none" });
    expect(returnVisual).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(returnVisual).toHaveAttribute("data-artifact-key", artifact.key);
    expect(returnVisual).toHaveStyle({ pointerEvents: "none" });
    expect(returnVisual).not.toHaveAttribute("data-animation-owner", "motion");
    expect(detailLight).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(detailLight).toHaveAttribute("aria-hidden", "true");
    expect(detailLight).toHaveStyle({ pointerEvents: "none" });
    expect(story).toHaveTextContent("A safe test relic.");
    expect(story).not.toHaveAttribute("aria-hidden");

    await waitFor(() =>
      expect(
        changes.some(
          (handles) =>
            handles?.artifactKey === artifact.key &&
            handles.layoutDestination !== null &&
            handles.engraving !== null &&
            handles.detailLight !== null &&
            handles.returnVisual !== null,
        ),
      ).toBe(true),
    );
    const registered = changes.findLast(
      (handles) => handles?.layoutDestination && handles.engraving && handles.detailLight && handles.returnVisual,
    )!;
    expect(registered!.layoutDestination!.target.targetId).not.toBe(registered!.engraving!.target.targetId);
    expect(registered!.engraving!.target.targetId).not.toBe(registered!.detailLight!.target.targetId);
    expect(registered!.returnVisual!.target.targetId).not.toBe(registered!.engraving!.target.targetId);
    expect(registered!.returnVisual!.target.part).toBe("artifact-return-visual");
    expect(registered!.layoutDestination!.target.hostId).toBe(registered!.engraving!.target.hostId);
    const engravingExternal = registered!.engraving!.exportForScene({
      allowedProperties: ["clip-path"],
      lifetime: "scene",
    });
    expect(engravingExternal.targetId).toBe(registered!.engraving!.target.targetId);
    engravingExternal.revoke();
    const returnExternal = registered!.returnVisual!.exportForScene({
      allowedProperties: ["opacity", "filter"],
      lifetime: "handoff",
    });
    expect(returnExternal.targetId).toBe(registered!.returnVisual!.target.targetId);
    returnExternal.revoke();
    expect(() =>
      registered!.engraving!.exportForScene({ allowedProperties: ["path-drawing"], lifetime: "scene" }),
    ).toThrow(/allowlist/i);
    const releasedLayout = registered!.layoutDestination!;
    const releasedReturn = registered!.returnVisual!;
    unmount();
    expect(changes.at(-1)).toBeNull();
    expect(() => releasedLayout.exportForScene({ allowedProperties: ["layout"], lifetime: "scene" })).toThrow();
    expect(() => releasedReturn.exportForScene({ allowedProperties: ["opacity"], lifetime: "scene" })).toThrow();
  });

  it("hands the live registration to the current callback and cleans the replaced consumer", async () => {
    const first = vi.fn<(handles: ArtifactInspectionTargetHandles | null) => void>();
    const second = vi.fn<(handles: ArtifactInspectionTargetHandles | null) => void>();
    const view = (callback: (handles: ArtifactInspectionTargetHandles | null) => void) => (
      <AnimationProvider>
        <ArtifactInspection artifact={artifact} close={vi.fn()} restoreFocus={null} onTargetHandlesChange={callback} />
      </AnimationProvider>
    );
    const { rerender } = render(view(first));
    await waitFor(() => expect(first.mock.calls.some(([handles]) => handles?.engraving)).toBe(true));

    rerender(view(second));
    await waitFor(() => expect(second.mock.calls.some(([handles]) => handles?.engraving)).toBe(true));
    expect(first).toHaveBeenLastCalledWith(null);
  });

  it("isolates bounded non-modal siblings while keeping the boxed modal exposed", async () => {
    render(
      <AnimationProvider>
        <main data-testid="inspection-background" aria-hidden="false">
          <button>Background action</button>
        </main>
        <aside data-testid="pre-isolated-background" aria-hidden="true" inert>
          Already isolated
        </aside>
        <ArtifactInspection artifact={artifact} close={vi.fn()} restoreFocus={null} />
      </AnimationProvider>,
    );

    const background = screen.getByTestId("inspection-background");
    const preIsolated = screen.getByTestId("pre-isolated-background");
    const dialog = screen.getByRole("dialog", { name: artifact.name });
    const backdrop = dialog.closest<HTMLElement>(".artifact-inspection-backdrop")!;

    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveAttribute("inert");
    expect(background.inert).toBe(true);
    expect(preIsolated).toHaveAttribute("aria-hidden", "true");
    expect(preIsolated.inert).toBe(true);
    expect(dialog).not.toHaveAttribute("aria-hidden");
    expect(dialog).not.toHaveAttribute("inert");
    expect(Boolean(dialog.inert)).toBe(false);
    expect(backdrop).not.toHaveAttribute("aria-hidden");
    expect(backdrop).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Close inspection" })).toHaveFocus();
  });

  it("restores exact sibling state after identity replacement and modal unmount", async () => {
    const secondArtifact: PublicArtifact = { ...artifact, key: "second-compass", name: "Second Compass" };
    const view = (activeArtifact: PublicArtifact | null) => (
      <AnimationProvider>
        <main data-testid="false-aria-background" aria-hidden="false">
          Visible background
        </main>
        <aside data-testid="inert-background" aria-hidden="true" inert>
          Preserved inert background
        </aside>
        <footer data-testid="attribute-free-background">Attribute-free background</footer>
        {activeArtifact && <ArtifactInspection artifact={activeArtifact} close={vi.fn()} restoreFocus={null} />}
      </AnimationProvider>
    );
    const rendered = render(view(artifact));
    const falseAria = screen.getByTestId("false-aria-background");
    const inertBackground = screen.getByTestId("inert-background");
    const attributeFree = screen.getByTestId("attribute-free-background");

    expect(falseAria).toHaveAttribute("aria-hidden", "true");
    expect(falseAria.inert).toBe(true);
    rendered.rerender(view(secondArtifact));
    expect(screen.getByRole("dialog", { name: secondArtifact.name })).not.toHaveAttribute("aria-hidden");
    expect(falseAria).toHaveAttribute("aria-hidden", "true");
    expect(falseAria.inert).toBe(true);

    rendered.rerender(view(null));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(falseAria).toHaveAttribute("aria-hidden", "false");
    expect(falseAria).not.toHaveAttribute("inert");
    expect(inertBackground).toHaveAttribute("aria-hidden", "true");
    expect(inertBackground).toHaveAttribute("inert", "");
    expect(attributeFree).not.toHaveAttribute("aria-hidden");
    expect(attributeFree).not.toHaveAttribute("inert");
  });

  it("keeps readable semantic content in reduced motion and never invokes the future scene", async () => {
    render(
      <AnimationProvider>
        <ArtifactInspection artifact={artifact} close={vi.fn()} restoreFocus={null} />
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: artifact.name })).toBeVisible());
    expect(screen.getByText(artifact.description!)).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-artifact-inspection-state", "readable");
    expect(document.querySelector("[data-scene-invocation='artifact-inspection']")).not.toBeInTheDocument();
  });

  it("keeps shared-layout props gated when no runtime lease can be granted", async () => {
    render(<ArtifactInspection artifact={artifact} close={vi.fn()} restoreFocus={null} />);
    const shell = document.querySelector<HTMLElement>("[data-artifact-target-role='layout-destination']")!;
    expect(shell).toHaveAttribute("data-runtime-lease", "gated");
    expect(shell).not.toHaveAttribute("data-shared-layout-id");
    expect(shell).not.toHaveAttribute("data-animation-owner");
    await waitFor(() => expect(screen.getByText(artifact.description!)).toBeVisible());
  });
});

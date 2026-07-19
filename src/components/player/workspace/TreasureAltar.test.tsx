import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicArtifact, PublicSnapshot } from "@/domain/story";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHost } from "@/animation/hosts/SceneHost";
import {
  TreasureAltar,
  type TreasureAltarArtifactTargetHandles,
  type TreasureAltarConnectionTargetHandle,
} from "./TreasureAltar";

const compass: PublicArtifact = {
  key: "development-compass",
  state: "AWARDED",
  name: "Development Compass",
  category: "NAVIGATION",
  description: "Points toward safe boundaries.",
  displayX: 24,
  displayY: 42,
  connectedArtifactKey: "keel-star",
  unseen: false,
};

const star: PublicArtifact = {
  key: "keel-star",
  state: "CONNECTED",
  name: "Keel Star",
  category: "TOKEN",
  description: "Answers the compass.",
  displayX: 72,
  displayY: 55,
  unseen: false,
};

const moon: PublicArtifact = {
  key: "harbor-moon",
  state: "AWARDED",
  name: "Harbor Moon",
  category: "TOKEN",
  description: "Keeps a second connection independently addressable.",
  displayX: 86,
  displayY: 28,
  unseen: false,
};

const connectedStar: PublicArtifact = { ...star, connectedArtifactKey: moon.key };

function snapshot(artifacts: PublicArtifact[]) {
  return { artifacts } as PublicSnapshot;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
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

function FocusGatedAltarButton({ onCapture }: { onCapture: (node: HTMLButtonElement) => void }) {
  useLayoutEffect(() => {
    const node = document.querySelector<HTMLButtonElement>(
      `[data-artifact-target-role='layout-source'][data-artifact-key='${compass.key}']`,
    );
    if (node?.dataset.runtimeLease === "gated") {
      node.focus();
      onCapture(node);
    }
  }, [onCapture]);

  return null;
}

describe("TreasureAltar animation boundary", () => {
  it("keeps semantic Motion shells separate from artifact-keyed GSAP destinations", () => {
    const inspect = vi.fn();
    render(<TreasureAltar snapshot={snapshot([compass, star])} inspect={inspect} />);

    const compassButton = screen.getByRole("button", { name: /Development Compass, awarded/i });
    const starButton = screen.getByRole("button", { name: /Keel Star, connected/i });
    for (const [button, key] of [
      [compassButton, compass.key],
      [starButton, star.key],
    ] as const) {
      expect(button).toHaveAttribute("data-runtime-boundary", "motion");
      expect(button).toHaveAttribute("data-runtime-lease", "gated");
      expect(button).not.toHaveAttribute("data-shared-layout-id");
      expect(button).not.toHaveAttribute("data-animation-owner");
      expect(button).toHaveAttribute("data-artifact-key", key);
      expect(button).not.toHaveAttribute("data-gsap-owned");
      const destination = button.querySelector<HTMLElement>("[data-artifact-target-role='cinematic-destination']")!;
      expect(destination).toHaveAttribute("data-runtime-boundary", "gsap");
      expect(destination).toHaveAttribute("data-artifact-key", key);
      expect(destination).toHaveAttribute("aria-hidden", "true");
      expect(destination).toHaveStyle({ pointerEvents: "none" });
    }

    fireEvent.click(compassButton);
    expect(inspect).toHaveBeenCalledWith(compass.key, compassButton);
    const connection = document.querySelector<SVGPathElement>(
      `[data-source-artifact-key='${compass.key}'][data-destination-artifact-key='${star.key}']`,
    );
    expect(connection).toBeInTheDocument();
    expect(connection).toHaveStyle({ pointerEvents: "none" });
    expect(document.querySelector(".artifact-reveal-prop")).not.toBeInTheDocument();
  });

  it("exposes distinct registered source and destination handles keyed by artifact identity", async () => {
    const changes: TreasureAltarArtifactTargetHandles[] = [];
    const connectionChanges: TreasureAltarConnectionTargetHandle[] = [];
    let focusedGatedButton: HTMLButtonElement | null = null;
    const { unmount } = render(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="altar-handle-test">
          <TreasureAltar
            snapshot={snapshot([compass, star])}
            inspect={vi.fn()}
            onArtifactTargetHandlesChange={(handles) => changes.push(handles)}
            onConnectionTargetHandleChange={(handle) => connectionChanges.push(handle)}
          />
          <FocusGatedAltarButton onCapture={(node) => (focusedGatedButton = node)} />
        </SceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => {
      for (const key of [compass.key, star.key]) {
        expect(
          changes.some(
            (handles) =>
              handles?.artifactKey === key && handles.layoutSource !== null && handles.cinematicDestination !== null,
          ),
        ).toBe(true);
      }
    });

    for (const key of [compass.key, star.key]) {
      const registered = changes.findLast(
        (handles) => handles?.artifactKey === key && handles.layoutSource && handles.cinematicDestination,
      )!;
      expect(registered!.layoutSource!.target.targetId).not.toBe(registered!.cinematicDestination!.target.targetId);
      expect(registered!.layoutSource!.target.hostId).toBe(registered!.cinematicDestination!.target.hostId);
      expect(registered!.layoutSource!.target.part).toBe("artifact-slot-target");
      expect(registered!.cinematicDestination!.target.part).toBe("artifact-slot-cinematic");
      const exported = registered!.layoutSource!.exportForScene({ allowedProperties: ["layout"], lifetime: "scene" });
      expect(exported.targetId).toBe(registered!.layoutSource!.target.targetId);
      exported.revoke();
      const shell = document.querySelector<HTMLElement>(
        `[data-artifact-target-role='layout-source'][data-artifact-key='${key}']`,
      )!;
      expect(shell).toHaveAttribute("data-runtime-lease", "ready");
      expect(shell).toHaveAttribute("data-shared-layout-id", `artifact-${key}`);
      if (key === compass.key) {
        const connectedFocusedButton = focusedGatedButton as HTMLButtonElement | null;
        expect(connectedFocusedButton).toBe(shell);
        expect(connectedFocusedButton?.isConnected).toBe(true);
        expect(connectedFocusedButton).toHaveFocus();
      }
    }
    await waitFor(() =>
      expect(
        connectionChanges.some(
          (connection) =>
            connection?.sourceArtifactKey === compass.key &&
            connection.destinationArtifactKey === star.key &&
            connection.target !== null,
        ),
      ).toBe(true),
    );
    expect(connectionChanges.findLast((connection) => connection?.target)?.target?.target.part).toBe(
      "artifact-connection-path",
    );
    const artifactCleanupStart = changes.length;
    const connectionCleanupStart = connectionChanges.length;
    unmount();
    const artifactCleanup = changes.slice(artifactCleanupStart);
    const connectionCleanup = connectionChanges.slice(connectionCleanupStart);
    for (const artifactKey of [compass.key, star.key]) {
      expect(artifactCleanup).toContainEqual({
        artifactKey,
        layoutSource: null,
        cinematicDestination: null,
      });
    }
    expect(connectionCleanup).toContainEqual({
      sourceArtifactKey: compass.key,
      destinationArtifactKey: star.key,
      target: null,
    });
  });

  it("tombstones only removed keyed producers while sibling handles remain live", async () => {
    const artifactChanges: TreasureAltarArtifactTargetHandles[] = [];
    const connectionChanges: TreasureAltarConnectionTargetHandle[] = [];
    const onArtifactChange = (handles: TreasureAltarArtifactTargetHandles) => artifactChanges.push(handles);
    const onConnectionChange = (handle: TreasureAltarConnectionTargetHandle) => connectionChanges.push(handle);
    const view = (artifacts: PublicArtifact[]) => (
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="altar-removal-test">
          <TreasureAltar
            snapshot={snapshot(artifacts)}
            inspect={vi.fn()}
            onArtifactTargetHandlesChange={onArtifactChange}
            onConnectionTargetHandleChange={onConnectionChange}
          />
        </SceneHost>
      </AnimationProvider>
    );
    const { rerender, unmount } = render(view([compass, connectedStar, moon]));

    await waitFor(() => {
      for (const artifactKey of [compass.key, connectedStar.key, moon.key]) {
        expect(
          artifactChanges.some(
            (handles) => handles.artifactKey === artifactKey && handles.layoutSource && handles.cinematicDestination,
          ),
        ).toBe(true);
      }
      for (const [sourceArtifactKey, destinationArtifactKey] of [
        [compass.key, connectedStar.key],
        [connectedStar.key, moon.key],
      ] as const) {
        expect(
          connectionChanges.some(
            (handle) =>
              handle.sourceArtifactKey === sourceArtifactKey &&
              handle.destinationArtifactKey === destinationArtifactKey &&
              handle.target,
          ),
        ).toBe(true);
      }
    });

    const survivingArtifact = artifactChanges.findLast(
      (handles) => handles.artifactKey === compass.key && handles.layoutSource && handles.cinematicDestination,
    )!;
    const survivingConnection = connectionChanges.findLast(
      (handle) =>
        handle.sourceArtifactKey === compass.key &&
        handle.destinationArtifactKey === connectedStar.key &&
        handle.target,
    )!;
    const artifactRemovalStart = artifactChanges.length;
    const connectionRemovalStart = connectionChanges.length;

    rerender(view([compass, connectedStar]));

    await waitFor(() => {
      expect(artifactChanges.slice(artifactRemovalStart)).toContainEqual({
        artifactKey: moon.key,
        layoutSource: null,
        cinematicDestination: null,
      });
      expect(connectionChanges.slice(connectionRemovalStart)).toContainEqual({
        sourceArtifactKey: connectedStar.key,
        destinationArtifactKey: moon.key,
        target: null,
      });
    });
    expect(artifactChanges.slice(artifactRemovalStart)).not.toContainEqual({
      artifactKey: compass.key,
      layoutSource: null,
      cinematicDestination: null,
    });
    expect(connectionChanges.slice(connectionRemovalStart)).not.toContainEqual({
      sourceArtifactKey: compass.key,
      destinationArtifactKey: connectedStar.key,
      target: null,
    });
    expect(
      document.querySelector(`[data-artifact-target-role='layout-source'][data-artifact-key='${compass.key}']`),
    ).toBeInTheDocument();
    const survivingArtifactExport = survivingArtifact.layoutSource!.exportForScene({
      allowedProperties: ["layout"],
      lifetime: "scene",
    });
    const survivingConnectionExport = survivingConnection.target!.exportForScene({
      allowedProperties: ["path-drawing"],
      lifetime: "scene",
    });
    survivingArtifactExport.revoke();
    survivingConnectionExport.revoke();

    const finalArtifactCleanupStart = artifactChanges.length;
    const finalConnectionCleanupStart = connectionChanges.length;
    unmount();
    const finalArtifactCleanup = artifactChanges.slice(finalArtifactCleanupStart);
    const finalConnectionCleanup = connectionChanges.slice(finalConnectionCleanupStart);
    for (const artifactKey of [compass.key, connectedStar.key]) {
      expect(finalArtifactCleanup).toContainEqual({
        artifactKey,
        layoutSource: null,
        cinematicDestination: null,
      });
    }
    expect(finalConnectionCleanup).toContainEqual({
      sourceArtifactKey: compass.key,
      destinationArtifactKey: connectedStar.key,
      target: null,
    });
  });

  it("preserves artifact-key target identity when display order changes", () => {
    const { rerender } = render(<TreasureAltar snapshot={snapshot([compass, star])} inspect={vi.fn()} />);
    const before = Array.from(
      document.querySelectorAll<HTMLElement>("[data-artifact-target-role='cinematic-destination']"),
    )
      .map((node) => node.dataset.artifactKey)
      .sort();

    rerender(<TreasureAltar snapshot={snapshot([star, compass])} inspect={vi.fn()} />);
    const after = Array.from(
      document.querySelectorAll<HTMLElement>("[data-artifact-target-role='cinematic-destination']"),
    )
      .map((node) => node.dataset.artifactKey)
      .sort();

    expect(before).toEqual([compass.key, star.key].sort());
    expect(after).toEqual(before);
  });

  it("uses unique heading IDs and delivers live handles to a replacement callback", async () => {
    const first = vi.fn<(handles: TreasureAltarArtifactTargetHandles) => void>();
    const second = vi.fn<(handles: TreasureAltarArtifactTargetHandles) => void>();
    const view = (callback: (handles: TreasureAltarArtifactTargetHandles) => void) => (
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="unique-altar-host">
          <TreasureAltar
            snapshot={snapshot([compass, star])}
            inspect={vi.fn()}
            onArtifactTargetHandlesChange={callback}
          />
        </SceneHost>
      </AnimationProvider>
    );
    const { rerender } = render(view(first));
    await waitFor(() => expect(first.mock.calls.some(([handles]) => handles?.layoutSource)).toBe(true));
    rerender(view(second));
    await waitFor(() => {
      for (const artifactKey of [compass.key, star.key]) {
        expect(
          second.mock.calls.some(
            ([handles]) => handles.artifactKey === artifactKey && handles.layoutSource && handles.cinematicDestination,
          ),
        ).toBe(true);
      }
    });
    for (const artifactKey of [compass.key, star.key]) {
      expect(first).toHaveBeenCalledWith({
        artifactKey,
        layoutSource: null,
        cinematicDestination: null,
      });
    }

    cleanup();
    render(
      <>
        <TreasureAltar snapshot={snapshot([compass])} inspect={vi.fn()} />
        <TreasureAltar snapshot={snapshot([star])} inspect={vi.fn()} />
      </>,
    );
    const headings = screen.getAllByRole("heading", { name: "Treasure Altar" });
    expect(headings[0].id).not.toBe(headings[1].id);
    const sections = document.querySelectorAll<HTMLElement>(".treasure-altar-section");
    expect(sections[0]).toHaveAttribute("aria-labelledby", headings[0].id);
    expect(sections[1]).toHaveAttribute("aria-labelledby", headings[1].id);
  });
});

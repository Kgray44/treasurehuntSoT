import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { PublicSnapshot } from "@/domain/story";
import {
  FinaleChamber,
  finaleMechanismTargetAllowedProperties,
  type FinaleChamberTargetRegistration,
  type FinaleMechanismTargetReady,
} from "./FinaleChamber";

const snapshot: PublicSnapshot = {
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "ACTIVE" },
  sequence: 28,
  chapter: { ordinal: 1, state: "ACTIVE", title: "First Light", hints: [] },
  chapters: [],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [],
  sideQuest: null,
  log: [],
  finale: {
    state: "REQUIREMENTS_PARTIAL",
    teaser: "The rings answer the voyage without revealing the ending.",
    requirements: [
      { key: "chapter-seals", label: "Chapter seals", current: 2, target: 3 },
      { key: "relics", label: "Recovered relics", current: 1, target: 2, optional: true },
    ],
    unseen: true,
  },
  unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 1 },
};

const fallbackPoseCases = [
  {
    state: "DORMANT",
    pose: "dormant",
    stateIndex: "0",
    label: "dormant",
    current: 0,
    progress: "0.000",
    description: "The mechanism rests without an active seal response.",
  },
  {
    state: "TEASED",
    pose: "teased",
    stateIndex: "1",
    label: "tease wake",
    current: 1,
    progress: "0.125",
    description: "The mechanism is awake while the final seal remains closed.",
  },
  {
    state: "SEALED",
    pose: "sealed",
    stateIndex: "2",
    label: "sealed",
    current: 2,
    progress: "0.250",
    description: "The final seal is closed and visibly holding.",
  },
  {
    state: "REQUIREMENTS_PARTIAL",
    pose: "partial",
    stateIndex: "3",
    label: "requirement partial",
    current: 4,
    progress: "0.500",
    description: "The mechanism shows incomplete requirement progress.",
  },
  {
    state: "READY",
    pose: "ready",
    stateIndex: "4",
    label: "ready",
    current: 8,
    progress: "1.000",
    description: "The requirements are ready and the seal is poised.",
  },
  {
    state: "UNLOCKING",
    pose: "unlocking",
    stateIndex: "5",
    label: "mechanism unlock",
    current: 8,
    progress: "1.000",
    description: "The seal is parting into its unlocking pose.",
  },
  {
    state: "UNLOCKED",
    pose: "unlocked",
    stateIndex: "6",
    label: "chamber expansion",
    current: 8,
    progress: "1.000",
    description: "The final seal is open and the chamber is revealed.",
  },
  {
    state: "COMPLETE",
    pose: "complete",
    stateIndex: "7",
    label: "complete",
    current: 8,
    progress: "1.000",
    description: "The finale mechanism has reached its complete pose.",
  },
] as const;

function snapshotWithFinaleState(state: string, current: number): PublicSnapshot {
  return {
    ...snapshot,
    finale: {
      ...snapshot.finale,
      state,
      requirements: [{ key: "final-seals", label: "Final seals", current, target: 8 }],
    },
  };
}

describe("FinaleChamber Phase 3 interface", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    vi.restoreAllMocks();
  });

  it("registers the exact changed requirement socket and path without sharing Motion's row", async () => {
    const registrations: FinaleChamberTargetRegistration[] = [];
    const view = render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="full"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="chapter-seals"
          onTargetRegistrationChange={(registration) => registrations.push(registration)}
        />
      </AnimationProvider>,
    );

    const changedRow = view.container.querySelector<HTMLElement>('[data-requirement-key="chapter-seals"]');
    const changedSocket = view.container.querySelector<HTMLElement>('[data-requirement-socket-key="chapter-seals"]');
    const changedPath = view.container.querySelector<SVGPathElement>('[data-requirement-path-key="chapter-seals"]');
    expect(changedRow).toHaveAttribute("data-progress-target", "true");
    expect(changedRow).toHaveAttribute("data-motion-layout-boundary");
    expect(changedRow).not.toHaveAttribute("data-gsap-owned");
    expect(changedSocket).toHaveAttribute("data-progress-target", "true");
    expect(changedSocket).toHaveAttribute("data-gsap-visual-boundary");
    expect(changedSocket).not.toHaveAttribute("data-animation-owner");
    expect(changedSocket).toHaveAttribute("aria-hidden", "true");
    expect(changedPath).toHaveAttribute("data-progress-target", "true");
    expect(changedPath).toHaveAttribute("data-scene-part", "finale-light-path");
    expect(view.container.querySelector('[data-requirement-key="relics"]')).not.toHaveAttribute("data-progress-target");

    await waitFor(() => expect(changedRow).toHaveAttribute("data-motion-ownership", "ready"));
    await waitFor(() => expect(changedSocket).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(changedPath).toHaveAttribute("data-scene-target-id"));
    await waitFor(() =>
      expect(
        registrations.some(
          (registration) =>
            registration.kind === "requirement-socket" && registration.key === "chapter-seals" && registration.handle,
        ),
      ).toBe(true),
    );
    expect(
      registrations.some(
        (registration) =>
          registration.kind === "requirement-path" && registration.key === "chapter-seals" && registration.handle,
      ),
    ).toBe(true);
    expect(screen.getByText("Chapter seals: 2 of 3. Mechanism state partial.")).toBeVisible();
  });

  it("exports one exact static mechanism handle and retracts it across the event lifecycle", async () => {
    const targetChanges: Array<FinaleMechanismTargetReady | null> = [];
    const onMechanismTargetChange = (ready: FinaleMechanismTargetReady | null) => targetChanges.push(ready);
    const view = render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="full"
          progressEventId="finale-tease-28"
          progressEventType="FINALE_TEASED"
          onMechanismTargetChange={onMechanismTargetChange}
        />
      </AnimationProvider>,
    );

    await waitFor(() => expect(targetChanges.some((change) => change !== null)).toBe(true));
    const firstReady = targetChanges.find((change): change is FinaleMechanismTargetReady => change !== null)!;
    const staticMechanism = view.container.querySelector<HTMLElement>('[data-scene-part="finale-mechanism"]');
    const riveSurface = view.container.querySelector<HTMLElement>(".finale-rive-contract");
    expect(staticMechanism).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(staticMechanism).toHaveAttribute("data-scene-target-id");
    expect(staticMechanism).toHaveAttribute("aria-hidden", "true");
    expect(staticMechanism).toHaveStyle({ pointerEvents: "none" });
    expect(staticMechanism).not.toHaveAttribute("data-animation-owner", "rive");
    const fallbackPose = staticMechanism?.querySelector<HTMLElement>('[data-finale-fallback="css-svg"]');
    expect(fallbackPose).toHaveAttribute("data-runtime-boundary", "css");
    expect(fallbackPose).not.toHaveAttribute("data-scene-target-id");
    expect(fallbackPose?.querySelectorAll("[data-scene-part], [data-gsap-visual-boundary]")).toHaveLength(0);
    expect(staticMechanism?.contains(riveSurface)).toBe(false);
    expect(riveSurface?.closest('[data-scene-part="finale-mechanism"]')).toBeNull();
    expect(firstReady.key).toBe("finale-mechanism");
    expect(firstReady.target.part).toBe("finale-mechanism");
    expect(firstReady.allowedProperties).toBe(finaleMechanismTargetAllowedProperties);
    expect(firstReady.allowedProperties).toEqual(["transform", "opacity"]);
    const external = firstReady.exportForScene({
      allowedProperties: ["transform", "opacity"],
      lifetime: "scene",
    });
    expect(external.allowedProperties).toEqual(["transform", "opacity"]);
    external.revoke();
    expect(() =>
      firstReady.exportForScene({
        allowedProperties: ["filter"],
        lifetime: "scene",
      }),
    ).toThrow();

    targetChanges.length = 0;
    view.rerender(
      <AnimationProvider>
        <FinaleChamber
          snapshot={{ ...snapshot, sequence: 29 }}
          mode="full"
          progressEventId="finale-requirement-29"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="chapter-seals"
          onMechanismTargetChange={onMechanismTargetChange}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(targetChanges.some((change) => change !== null)).toBe(true));
    expect(targetChanges[0]).toBeNull();
    const replacementReady = targetChanges.find((change): change is FinaleMechanismTargetReady => change !== null)!;
    expect(replacementReady.target.targetId).not.toBe(firstReady.target.targetId);
    expect(() =>
      firstReady.exportForScene({
        allowedProperties: ["opacity"],
        lifetime: "scene",
      }),
    ).toThrow();

    targetChanges.length = 0;
    view.unmount();
    expect(targetChanges).toEqual([null]);
  });

  it("does not fall back to the last requirement when the exact key is absent", () => {
    const view = render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="gentle"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="missing-requirement"
        />
      </AnimationProvider>,
    );

    expect(view.container.querySelectorAll('[data-progress-target="true"]')).toHaveLength(0);
    expect(screen.getByText("Mechanism state partial. 3 of 5 progress steps are visible.")).toBeVisible();
  });

  it("keeps tease and requirement-update settled states distinct and readable", () => {
    const view = render(
      <AnimationProvider>
        <FinaleChamber snapshot={snapshot} mode="full" progressEventType="FINALE_TEASED" />
      </AnimationProvider>,
    );

    const chamber = view.container.querySelector('[data-finale-presentation-state="tease-settled"]');
    expect(chamber).not.toBeNull();
    expect(screen.getByText("The final seal is awake and remains partial.")).toBeVisible();

    view.rerender(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="full"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="relics"
        />
      </AnimationProvider>,
    );
    expect(
      view.container.querySelector('[data-finale-presentation-state="requirement-update-settled"]'),
    ).not.toBeNull();
    expect(screen.getByText("Recovered relics: 1 of 2. Mechanism state partial.")).toBeVisible();
  });

  it.each(fallbackPoseCases)(
    "renders the authoritative $pose CSS/SVG pose with exact state and progress evidence",
    ({ state, pose, stateIndex, label, current, progress, description }) => {
      const view = render(
        <AnimationProvider>
          <FinaleChamber snapshot={snapshotWithFinaleState(state, current)} mode="full" />
        </AnimationProvider>,
      );

      const chamber = view.container.querySelector<HTMLElement>(`[data-finale-pose="${pose}"]`);
      const fallback = view.container.querySelector<HTMLElement>(
        `[data-finale-fallback="css-svg"][data-finale-state="${pose}"]`,
      );
      expect(chamber).toHaveAttribute("data-finale-authoritative-state", state);
      expect(chamber).toHaveAttribute("data-finale-semantic-label", label);
      expect(chamber).toHaveAttribute("data-finale-progress", progress);
      expect(chamber).toHaveAttribute("data-finale-reduced-equivalent", "semantic-final-state");
      expect(fallback).toHaveAttribute("data-finale-state-index", stateIndex);
      expect(fallback).toHaveAttribute("data-finale-semantic-label", label);
      expect(fallback).toHaveAttribute("data-finale-progress", progress);
      expect(fallback).toHaveAttribute("data-finale-motion-mode", "full");
      expect(fallback).toHaveAttribute("data-finale-reduced-equivalent", "semantic-final-state");
      expect(fallback).toHaveAttribute("data-finale-production-art-status", "blocked_external_asset");
      expect(fallback).toHaveAttribute("data-runtime-boundary", "css");
      expect(fallback).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText(`${description} ${current} of 8 progress steps are visible.`)).toBeVisible();
      expect(view.container.querySelector('[data-rive-contract-availability="blocked_external_asset"]')).not.toBeNull();
      expect(view.container.querySelector('[data-rive-runtime-status="ready"]')).toBeNull();
    },
  );

  it("keeps the same unlocking meaning and progress in the reduced-equivalent final pose", () => {
    const view = render(
      <AnimationProvider>
        <FinaleChamber snapshot={snapshotWithFinaleState("UNLOCKING", 6)} mode="reduced" />
      </AnimationProvider>,
    );

    const fallback = view.container.querySelector<HTMLElement>(
      '[data-finale-fallback="css-svg"][data-finale-state="unlocking"]',
    );
    expect(fallback).toHaveAttribute("data-finale-semantic-label", "mechanism unlock");
    expect(fallback).toHaveAttribute("data-finale-progress", "0.750");
    expect(fallback).toHaveAttribute("data-finale-motion-mode", "reduced");
    expect(fallback).toHaveAttribute("data-finale-reduced-equivalent", "semantic-final-state");
    expect(fallback?.querySelector(".finale-fallback-seal-left")).not.toBeNull();
    expect(fallback?.querySelector(".finale-fallback-seal-right")).not.toBeNull();
    expect(screen.getByText(/The seal is parting into its unlocking pose\. 6 of 8 progress steps/)).toBeVisible();
  });

  it("reports the missing Phase 5 binary as fallback while reduced mode preserves the same meaning", async () => {
    const statuses = vi.fn();
    const view = render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="reduced"
          progressEventId="finale-event-28"
          onMechanismStatusChange={statuses}
        />
      </AnimationProvider>,
    );

    expect(
      screen.getByRole("img", {
        name: /Finale mechanism, partial; 3 of 5 progress.*Original Rive artwork is not yet supplied/,
      }),
    ).toBeVisible();
    await waitFor(() => expect(statuses).toHaveBeenCalledWith("fallback"));
    expect(view.container.querySelector('[data-rive-contract-availability="blocked_external_asset"]')).toHaveAttribute(
      "data-rive-runtime-status",
      "fallback",
    );
    expect(view.container.querySelector('[data-finale-pose="partial"]')).toHaveAttribute(
      "data-finale-presentation-state",
      "authoritative-settled",
    );
    expect(view.container.querySelector(".finale-rive-contract")).toHaveAttribute(
      "data-rive-semantic-signals",
      "stage,overallProgress,activeRequirement,requirementProgress,isReady",
    );
    expect(view.container.querySelector(".finale-rive-contract")).toHaveAttribute("data-rive-state-value", "3");
    expect(view.container.querySelector(".finale-rive-contract")).toHaveAttribute("data-rive-progress-value", "0.600");
    expect(view.container.querySelector(".finale-rive-contract")).toHaveAttribute(
      "data-rive-semantic-dispatches",
      "stage,overallProgress,activeRequirement,requirementProgress,isReady",
    );
    expect(view.container.querySelector(".finale-rive-contract")).toHaveAttribute(
      "data-rive-reduced-pose",
      JSON.stringify({
        stage: 0,
        overallProgress: 0,
        activeRequirement: -1,
        requirementProgress: 0,
        isReady: false,
        reducedMotion: true,
      }),
    );
    expect(screen.getByText("Mechanism state partial. 3 of 5 progress steps are visible.")).toBeVisible();
    expect(view.container.querySelector(".constellation-field")).toHaveAttribute("aria-hidden", "true");
    expect(
      view.container.querySelector('.finale-mechanism-static > img[src$="celestial-mechanism.svg"]'),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("retracts stale mechanism status on event replacement and unmount before a fresh adapter reports", async () => {
    const statuses =
      vi.fn<(status: "loading" | "ready" | "timed-out" | "failed" | "fallback" | "paused" | "hidden" | null) => void>();
    const view = render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={snapshot}
          mode="full"
          progressEventId="finale-tease-28"
          progressEventType="FINALE_TEASED"
          onMechanismStatusChange={statuses}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(statuses).toHaveBeenLastCalledWith("fallback"));
    const firstAdapter = view.container.querySelector(".finale-rive-contract");
    expect(firstAdapter).not.toBeNull();

    statuses.mockClear();
    view.rerender(
      <AnimationProvider>
        <FinaleChamber
          snapshot={{ ...snapshot, sequence: 29 }}
          mode="full"
          progressEventId="finale-requirement-29"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="chapter-seals"
          onMechanismStatusChange={statuses}
        />
      </AnimationProvider>,
    );

    await waitFor(() => expect(statuses).toHaveBeenLastCalledWith("fallback"));
    expect(statuses.mock.calls[0]?.[0]).toBeNull();
    const replacementAdapter = view.container.querySelector(".finale-rive-contract");
    expect(replacementAdapter).not.toBe(firstAdapter);
    expect(replacementAdapter).toHaveAttribute("data-rive-runtime-status", "fallback");

    statuses.mockClear();
    view.unmount();
    expect(statuses).toHaveBeenCalledOnce();
    expect(statuses).toHaveBeenLastCalledWith(null);

    const remountStatuses =
      vi.fn<(status: "loading" | "ready" | "timed-out" | "failed" | "fallback" | "paused" | "hidden" | null) => void>();
    render(
      <AnimationProvider>
        <FinaleChamber
          snapshot={{ ...snapshot, sequence: 29 }}
          mode="full"
          progressEventId="finale-requirement-29"
          progressEventType="FINALE_REQUIREMENT_UPDATED"
          progressRequirementKey="chapter-seals"
          onMechanismStatusChange={remountStatuses}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(remountStatuses).toHaveBeenLastCalledWith("fallback"));
  });
});

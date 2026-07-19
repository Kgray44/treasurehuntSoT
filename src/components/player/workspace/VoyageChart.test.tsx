import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationOwnershipRegistry } from "@/animation/core/ownership";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { PublicSnapshot } from "@/domain/story";
import { VoyageChart, type VoyageChartTargetRegistration } from "./VoyageChart";

vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: ({ label, mode }: { label: string; mode: string }) => (
    <div data-testid="chart-lottie" data-mode={mode}>
      {label}
    </div>
  ),
}));

const locations: PublicSnapshot["mapLocations"] = [
  {
    key: "harbor",
    state: "REVEALED",
    label: "Harbor",
    name: "Lantern Harbor",
    regionLabel: "North Reach",
    description: "A safe light on the shoals.",
    x: 20,
    y: 60,
    unseen: false,
  },
  {
    key: "cove",
    state: "REVEALED",
    label: "Cove",
    name: "Waking Cove",
    regionLabel: "East Reach",
    x: 70,
    y: 35,
    unseen: true,
  },
];

const routes: PublicSnapshot["mapRoutes"] = [
  {
    key: "harbor-to-cove",
    fromKey: "harbor",
    toKey: "cove",
    ordinal: 1,
    state: "REVEALED",
    annotation: "Follow the lanterns.",
    unseen: true,
  },
];

const snapshot: PublicSnapshot = {
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "ACTIVE" },
  sequence: 8,
  chapter: { ordinal: 1, state: "ACTIVE", title: "First Light", hints: [] },
  chapters: [],
  artifacts: [],
  mapLocations: locations,
  mapRoutes: routes,
  sideQuests: [],
  sideQuest: null,
  log: [],
  finale: { state: "LOCKED", requirements: [], unseen: false },
  unseen: { journal: 0, chart: 1, treasures: 0, quests: 0, log: 0, finale: 0 },
};

function matchMedia(reduced = false) {
  return vi.fn(() => ({
    matches: reduced,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("VoyageChart animation boundary", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia() });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    vi.restoreAllMocks();
  });

  it("splits Motion marker layout from the pointer-inert GSAP visual and registers exact semantic keys", async () => {
    const registrations: VoyageChartTargetRegistration[] = [];
    const activate = vi.fn();
    const view = render(
      <AnimationProvider>
        <VoyageChart
          snapshot={snapshot}
          mode="full"
          progressLocationKey="harbor"
          progressRouteKey="harbor-to-cove"
          onLocationActivate={activate}
          onTargetRegistrationChange={(registration) => registrations.push(registration)}
        />
      </AnimationProvider>,
    );

    const marker = view.container.querySelector<HTMLButtonElement>('[data-location-key="harbor"]');
    const visual = view.container.querySelector<HTMLElement>('[data-marker-visual-key="harbor"]');
    const route = view.container.querySelector<SVGPathElement>('[data-route-key="harbor-to-cove"]');
    expect(marker).not.toBeNull();
    expect(visual).not.toBeNull();
    expect(route).not.toBeNull();
    expect(marker).toHaveAttribute("data-motion-layout-boundary");
    expect(marker).not.toHaveAttribute("data-gsap-owned");
    expect(marker).toHaveAttribute("data-progress-target", "true");
    expect(visual).toHaveAttribute("data-gsap-visual-boundary");
    expect(visual).not.toHaveAttribute("data-animation-owner");
    expect(visual).toHaveAttribute("aria-hidden", "true");
    expect(visual).toHaveStyle({ pointerEvents: "none" });
    expect(route).toHaveAttribute("data-progress-target", "true");
    expect(route).toHaveStyle({ pointerEvents: "none" });
    expect(view.container.querySelector('[data-ship-key="test-voyage"]')).toHaveStyle({ pointerEvents: "none" });
    expect(view.container.querySelector('[data-fog-key="test-voyage"]')).toHaveStyle({ pointerEvents: "none" });
    expect(view.container.querySelector("[data-route-motion-path]")).toBeNull();

    await waitFor(() => expect(marker).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(marker).toHaveAttribute("data-animation-owner", "motion"));
    expect(marker).toHaveAttribute("data-motion-ownership", "ready");
    await waitFor(() => expect(visual).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(route).toHaveAttribute("data-scene-target-id"));
    await waitFor(() =>
      expect(
        registrations.some(
          (registration) =>
            registration.kind === "location-visual" && registration.key === "harbor" && registration.handle,
        ),
      ).toBe(true),
    );
    expect(
      registrations.some((registration) => registration.kind === "route-path" && registration.key === "harbor-to-cove"),
    ).toBe(true);

    marker?.focus();
    expect(marker).toHaveFocus();
    fireEvent.click(marker!);
    expect(activate).toHaveBeenCalledWith("harbor");
    expect(within(marker!).getByText("Lantern Harbor")).toBeVisible();
  });

  it("keeps progress identity keyed when location order changes and preserves keyboard panning", async () => {
    const view = render(
      <AnimationProvider>
        <VoyageChart snapshot={snapshot} mode="full" progressLocationKey="harbor" />
      </AnimationProvider>,
    );
    const viewport = screen.getByLabelText("Interactive voyage chart. Use arrow keys to pan.");
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    fireEvent(viewport, event);
    expect(event.defaultPrevented).toBe(true);

    view.rerender(
      <AnimationProvider>
        <VoyageChart
          snapshot={{ ...snapshot, mapLocations: [...snapshot.mapLocations].reverse() }}
          mode="full"
          progressLocationKey="harbor"
        />
      </AnimationProvider>,
    );

    const selected = view.container.querySelectorAll('[data-location-key][data-progress-target="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("data-location-key", "harbor");
    expect(view.container.querySelector('[data-location-key="cove"]')).not.toHaveAttribute("data-progress-target");
  });

  it("deduplicates exact entity producers, excludes unplotted targets, and retracts stale capabilities", async () => {
    const changes: VoyageChartTargetRegistration[] = [];
    const onChange = (registration: VoyageChartTargetRegistration) => changes.push(registration);
    const unplotted = {
      ...locations[1],
      key: "unplotted",
      name: "Unplotted Shoal",
      x: undefined,
      y: undefined,
    };
    const duplicateSnapshot: PublicSnapshot = {
      ...snapshot,
      mapLocations: [locations[0], { ...locations[0], name: "Duplicate Harbor" }, locations[1], unplotted],
      mapRoutes: [routes[0], { ...routes[0], annotation: "Duplicate route" }],
    };
    const view = render(
      <AnimationProvider>
        <VoyageChart snapshot={duplicateSnapshot} mode="full" onTargetRegistrationChange={onChange} />
      </AnimationProvider>,
    );

    expect(view.container.querySelectorAll('[data-marker-visual-key="harbor"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-route-key="harbor-to-cove"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-marker-visual-key="unplotted"]')).not.toBeInTheDocument();
    expect(screen.getByText("Unplotted Shoal")).toBeVisible();

    await waitFor(() =>
      expect(
        changes.some(
          (registration) =>
            registration.kind === "location-visual" &&
            registration.key === "harbor" &&
            registration.handle &&
            registration.exportForScene,
        ),
      ).toBe(true),
    );
    const harbor = changes.findLast(
      (registration) =>
        registration.kind === "location-visual" && registration.key === "harbor" && registration.exportForScene,
    )!;
    const exported = harbor.exportForScene!({ allowedProperties: ["transform"], lifetime: "scene" });
    expect(exported.targetId).toBe(harbor.handle!.targetId);
    exported.revoke();

    view.rerender(
      <AnimationProvider>
        <VoyageChart
          snapshot={{ ...snapshot, mapLocations: [locations[1]], mapRoutes: [] }}
          mode="full"
          onTargetRegistrationChange={onChange}
        />
      </AnimationProvider>,
    );
    await waitFor(() =>
      expect(
        changes.some(
          (registration) =>
            registration.kind === "location-visual" &&
            registration.key === "harbor" &&
            registration.handle === null &&
            registration.exportForScene === null,
        ),
      ).toBe(true),
    );
    expect(view.container.querySelector('[data-marker-visual-key="harbor"]')).not.toBeInTheDocument();
    expect(() => harbor.exportForScene!({ allowedProperties: ["transform"], lifetime: "scene" })).toThrow();
    expect(view.container.querySelector('[data-marker-visual-key="cove"]')).toBeInTheDocument();
  });

  it("keeps the chart static and semantic when a Motion surface lease is denied", () => {
    vi.spyOn(AnimationOwnershipRegistry.prototype, "claim").mockImplementation((request) => ({
      status: "rejected",
      requestedTargetId: request.targetId,
      property: request.properties[0] ?? "layout",
      group: "spatial-transform",
      requestedOwner: request.runtime,
      existingOwner: "gsap",
      reason: "property-conflict",
    }));
    const activate = vi.fn();
    const view = render(
      <AnimationProvider>
        <VoyageChart snapshot={snapshot} mode="full" onLocationActivate={activate} />
      </AnimationProvider>,
    );

    const surface = view.container.querySelector<HTMLElement>('[data-chart-target-key="chart"]');
    const marker = view.container.querySelector<HTMLButtonElement>('[data-location-key="harbor"]');
    expect(surface).toHaveAttribute("data-motion-ownership", "static");
    expect(surface).not.toHaveAttribute("data-animation-owner");
    expect(surface).not.toHaveAttribute("data-scene-target-id");
    expect(surface?.style.transform).toBe("");
    expect(marker).toHaveAttribute("data-motion-ownership", "static");
    expect(marker).not.toHaveAttribute("data-animation-owner");
    expect(marker).not.toHaveAttribute("data-scene-target-id");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Zoom 120%")).toBeVisible();
    expect(surface?.style.transform).toBe("");
    marker?.focus();
    fireEvent.click(marker!);
    expect(marker).toHaveFocus();
    expect(activate).toHaveBeenCalledWith("harbor");
    expect(screen.getAllByText("Lantern Harbor").length).toBeGreaterThanOrEqual(2);
  });

  it("isolates duplicate chart hosts and keeps reduced output readable", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia(true) });
    localStorage.setItem("forever-motion", "reduced");
    const view = render(
      <AnimationProvider>
        <VoyageChart snapshot={snapshot} mode="reduced" />
        <VoyageChart snapshot={snapshot} mode="reduced" />
      </AnimationProvider>,
    );

    const sections = view.container.querySelectorAll<HTMLElement>("section.voyage-chart-section");
    expect(sections).toHaveLength(2);
    expect(sections[0].getAttribute("aria-labelledby")).not.toBe(sections[1].getAttribute("aria-labelledby"));
    await waitFor(() =>
      expect(sections[0].querySelector('[data-marker-visual-key="harbor"]')).toHaveAttribute("data-scene-target-id"),
    );
    await waitFor(() =>
      expect(sections[1].querySelector('[data-marker-visual-key="harbor"]')).toHaveAttribute("data-scene-target-id"),
    );
    expect(
      sections[0].querySelector('[data-marker-visual-key="harbor"]')?.getAttribute("data-scene-target-id"),
    ).not.toBe(sections[1].querySelector('[data-marker-visual-key="harbor"]')?.getAttribute("data-scene-target-id"));
    expect(screen.getAllByText("Lantern Harbor").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId("chart-lottie")[0]).toHaveAttribute("data-mode", "reduced");
  });

  it("mounts the truthful decorative Voyage Compass fallback with keyed state and bearing inputs", async () => {
    const statuses: Array<"loading" | "ready" | "failed" | "fallback" | null> = [];
    const view = render(
      <AnimationProvider>
        <VoyageChart
          snapshot={snapshot}
          mode="full"
          progressRouteKey="harbor-to-cove"
          onCompassStatusChange={(status) => statuses.push(status)}
        />
      </AnimationProvider>,
    );

    const contract = view.container.querySelector<HTMLElement>("[data-voyage-compass-contract]");
    expect(contract).not.toBeNull();
    expect(contract).toHaveAttribute("aria-hidden", "true");
    expect(contract).toHaveAttribute("data-rive-contract-availability", "blocked_external_asset");
    expect(contract).toHaveAttribute("data-rive-production-art-status", "blocked_external_asset");
    expect(contract).toHaveAttribute("data-rive-state", "bearing");
    expect(contract).toHaveAttribute("data-rive-state-value", "1");
    expect(contract).toHaveAttribute("data-rive-route-key", "harbor-to-cove");
    expect(contract).toHaveAttribute("data-rive-inputs", "state,bearing,arrive");
    expect(contract).toHaveAttribute("data-rive-reduced-pose", JSON.stringify({ state: 0, bearing: 0 }));
    expect(contract).toHaveAttribute("data-rive-reduced-equivalent", "semantic-final-state");
    expect(Number(contract?.dataset.riveBearingValue)).toBeCloseTo(0.176208, 5);
    expect(contract).toHaveStyle({ pointerEvents: "none" });
    expect(contract?.querySelector("img")).toHaveAttribute("src", "/animations/stills/compass-fallback.svg");
    expect(
      contract?.querySelector("[data-scene-part], [data-scene-target-id], [data-animation-owner], [data-gsap-owned]"),
    ).toBeNull();
    expect(
      view.container.querySelector('.illustrated-chart > img[src="/illustrations/chart/voyage-chart.svg"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The voyage compass holds the released bearing for route harbor-to-cove."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Lantern Harbor").length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(contract).toHaveAttribute("data-rive-runtime-status", "fallback"));
    await waitFor(() => expect(contract).toHaveAttribute("data-rive-active-signal", "bearing"));
    expect(contract).toHaveAttribute("data-rive-semantic-dispatches", "state,bearing");
    expect(statuses.at(-1)).toBe("fallback");

    view.rerender(
      <AnimationProvider>
        <VoyageChart
          snapshot={{
            ...snapshot,
            sequence: 9,
            mapRoutes: [{ ...routes[0], state: "ARRIVED" }],
          }}
          mode="reduced"
          progressRouteKey="harbor-to-cove"
          onCompassStatusChange={(status) => statuses.push(status)}
        />
      </AnimationProvider>,
    );
    const arrived = view.container.querySelector<HTMLElement>("[data-voyage-compass-contract]");
    await waitFor(() => expect(arrived).toHaveAttribute("data-rive-runtime-status", "fallback"));
    expect(arrived).toHaveAttribute("data-rive-state", "arrived");
    expect(arrived).toHaveAttribute("data-rive-state-value", "2");
    expect(arrived).toHaveAttribute("data-rive-reduced-equivalent", "semantic-final-state");
    expect(screen.getByText("The voyage compass marks arrival for route harbor-to-cove.")).toBeInTheDocument();
    expect(statuses).toContain(null);
    expect(statuses.at(-1)).toBe("fallback");

    view.rerender(
      <AnimationProvider>
        <VoyageChart
          snapshot={{ ...snapshot, sequence: 10 }}
          mode="reduced"
          onCompassStatusChange={(status) => statuses.push(status)}
        />
      </AnimationProvider>,
    );
    const idle = view.container.querySelector<HTMLElement>("[data-voyage-compass-contract]");
    await waitFor(() => expect(idle).toHaveAttribute("data-rive-runtime-status", "fallback"));
    expect(idle).toHaveAttribute("data-rive-state", "idle");
    expect(idle).toHaveAttribute("data-rive-bearing-value", "0.000000");
    expect(screen.getByText("The voyage compass is idle; no exact route bearing is active.")).toBeInTheDocument();

    view.unmount();
    expect(statuses.at(-1)).toBeNull();
  });
});

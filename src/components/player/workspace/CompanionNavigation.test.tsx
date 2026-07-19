import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHost } from "@/animation/hosts/SceneHost";
import type { PublicSnapshot } from "@/domain/story";
import {
  CompanionNavigation,
  MobileNavigation,
  companionDesktopNavigationDimTargetKey,
  companionMobileNavigationDimTargetKey,
  type CompanionNavigationDimTargetRegistration,
} from "./CompanionNavigation";

const unseen: PublicSnapshot["unseen"] = {
  journal: 0,
  chart: 2,
  treasures: 0,
  quests: 0,
  log: 0,
  finale: 0,
};

describe("CompanionNavigation animation boundaries", () => {
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

  it("keeps desktop and mobile controls semantic while isolating one dim child per surface", () => {
    const navigate = vi.fn();
    const view = render(
      <>
        <CompanionNavigation view="journal" unseen={unseen} navigate={navigate} />
        <MobileNavigation view="chart" unseen={unseen} navigate={navigate} />
      </>,
    );

    const desktop = screen.getByRole("navigation", { name: "Companion sections" });
    const mobile = screen.getByRole("navigation", { name: "Companion views" });
    const desktopDim = desktop.querySelector<HTMLElement>(
      `[data-scene-part="${companionDesktopNavigationDimTargetKey}"]`,
    );
    const mobileDim = mobile.querySelector<HTMLElement>(`[data-scene-part="${companionMobileNavigationDimTargetKey}"]`);

    expect(desktopDim).toHaveAttribute("aria-hidden", "true");
    expect(desktopDim).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(desktopDim).not.toHaveAttribute("data-animation-owner");
    expect(desktopDim).not.toHaveAttribute("data-gsap-owned");
    expect(desktopDim).toHaveStyle({ position: "absolute", pointerEvents: "none", opacity: 0 });
    expect(mobileDim).toHaveAttribute("aria-hidden", "true");
    expect(mobileDim).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(mobileDim).not.toHaveAttribute("data-animation-owner");
    expect(mobileDim).not.toHaveAttribute("data-gsap-owned");
    expect(mobileDim).toHaveStyle({ position: "absolute", pointerEvents: "none", opacity: 0 });
    expect(desktop.querySelectorAll(`[data-scene-part="${companionDesktopNavigationDimTargetKey}"]`)).toHaveLength(1);
    expect(mobile.querySelectorAll(`[data-scene-part="${companionMobileNavigationDimTargetKey}"]`)).toHaveLength(1);
    expect(desktop.querySelector(`[data-scene-part="${companionMobileNavigationDimTargetKey}"]`)).toBeNull();
    expect(mobile.querySelector(`[data-scene-part="${companionDesktopNavigationDimTargetKey}"]`)).toBeNull();
    expect(desktop).not.toHaveAttribute("data-gsap-owned");
    expect(mobile).not.toHaveAttribute("data-gsap-owned");
    expect(view.container.querySelector('[data-scene-part="peripheral"]')).toBeNull();
    expect(view.container.querySelector("button[data-gsap-owned]")).toBeNull();

    expect(within(desktop).getByRole("button", { name: /Journal/u })).toHaveAttribute("aria-current", "page");
    expect(within(desktop).getByLabelText("2 unseen")).toBeVisible();
    fireEvent.click(within(desktop).getByRole("button", { name: /Chart/u }));
    fireEvent.click(within(mobile).getByRole("button", { name: /Finale/u }));
    expect(navigate).toHaveBeenNthCalledWith(1, "chart");
    expect(navigate).toHaveBeenNthCalledWith(2, "finale");
  });

  it("marks only the active desktop and mobile destinations as the current page", () => {
    const view = render(
      <>
        <CompanionNavigation view="journal" unseen={unseen} navigate={vi.fn()} />
        <MobileNavigation view="chart" unseen={unseen} navigate={vi.fn()} />
      </>,
    );

    const desktop = within(view.container).getByRole("navigation", { name: "Companion sections" });
    const mobile = within(view.container).getByRole("navigation", { name: "Companion views" });

    expect(within(desktop).getByRole("button", { name: /Journal/u })).toHaveAttribute("aria-current", "page");
    expect(within(desktop).getByRole("button", { name: /Chart/u })).not.toHaveAttribute("aria-current");
    expect(within(mobile).getByRole("button", { name: /Chart/u })).toHaveAttribute("aria-current", "page");
    expect(within(mobile).getByRole("button", { name: /Journal/u })).not.toHaveAttribute("aria-current");

    expect(
      within(desktop)
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("aria-current")),
    ).toHaveLength(1);
    expect(
      within(mobile)
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("exports distinct host-local desktop and mobile handles", async () => {
    type DesktopRegistration = CompanionNavigationDimTargetRegistration<typeof companionDesktopNavigationDimTargetKey>;
    type MobileRegistration = CompanionNavigationDimTargetRegistration<typeof companionMobileNavigationDimTargetKey>;
    let desktopRegistration: DesktopRegistration | null = null;
    let mobileRegistration: MobileRegistration | null = null;
    const onDesktopChange = vi.fn((next: DesktopRegistration | null) => {
      desktopRegistration = next;
    });
    const onMobileChange = vi.fn((next: MobileRegistration | null) => {
      mobileRegistration = next;
    });
    const view = render(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="companion-navigation-test">
          <CompanionNavigation view="journal" unseen={unseen} navigate={vi.fn()} onDimTargetChange={onDesktopChange} />
          <MobileNavigation view="journal" unseen={unseen} navigate={vi.fn()} onDimTargetChange={onMobileChange} />
        </SceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => {
      expect(desktopRegistration).not.toBeNull();
      expect(mobileRegistration).not.toBeNull();
    });
    const desktop = desktopRegistration as DesktopRegistration | null;
    const mobile = mobileRegistration as MobileRegistration | null;
    if (!desktop || !mobile) throw new Error("Companion navigation dim targets were not registered");
    expect(desktop.key).toBe(companionDesktopNavigationDimTargetKey);
    expect(mobile.key).toBe(companionMobileNavigationDimTargetKey);
    expect(desktop.target.hostId).toBe(mobile.target.hostId);
    expect(desktop.target.targetId).not.toBe(mobile.target.targetId);
    expect(desktop.target.part).toBe(companionDesktopNavigationDimTargetKey);
    expect(mobile.target.part).toBe(companionMobileNavigationDimTargetKey);
    expect(
      view.container.querySelector(`[data-scene-part="${companionDesktopNavigationDimTargetKey}"]`),
    ).not.toHaveAttribute("data-animation-owner");
    expect(
      view.container.querySelector(`[data-scene-part="${companionMobileNavigationDimTargetKey}"]`),
    ).not.toHaveAttribute("data-animation-owner");

    const desktopExternal = desktop.exportForScene({
      allowedProperties: ["opacity"],
      lifetime: "handoff",
    });
    const mobileExternal = mobile.exportForScene({
      allowedProperties: ["opacity"],
      lifetime: "handoff",
    });
    expect(desktopExternal.targetId).toBe(desktop.target.targetId);
    expect(mobileExternal.targetId).toBe(mobile.target.targetId);
    expect(desktopExternal.externalTargetId).not.toBe(mobileExternal.externalTargetId);

    let replacementDesktop: DesktopRegistration | null = null;
    let replacementMobile: MobileRegistration | null = null;
    const replacementDesktopConsumer = vi.fn((next: DesktopRegistration | null) => {
      replacementDesktop = next;
    });
    const replacementMobileConsumer = vi.fn((next: MobileRegistration | null) => {
      replacementMobile = next;
    });
    view.rerender(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="companion-navigation-test">
          <CompanionNavigation
            view="journal"
            unseen={unseen}
            navigate={vi.fn()}
            onDimTargetChange={replacementDesktopConsumer}
          />
          <MobileNavigation
            view="journal"
            unseen={unseen}
            navigate={vi.fn()}
            onDimTargetChange={replacementMobileConsumer}
          />
        </SceneHost>
      </AnimationProvider>,
    );
    await waitFor(() => {
      expect(replacementDesktop).toBe(desktop);
      expect(replacementMobile).toBe(mobile);
    });
    expect(onDesktopChange).toHaveBeenLastCalledWith(null);
    expect(onMobileChange).toHaveBeenLastCalledWith(null);

    view.unmount();
    expect(replacementDesktopConsumer).toHaveBeenLastCalledWith(null);
    expect(replacementMobileConsumer).toHaveBeenLastCalledWith(null);
  });
});

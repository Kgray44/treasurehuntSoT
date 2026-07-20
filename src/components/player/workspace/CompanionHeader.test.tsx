import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHost } from "@/animation/hosts/SceneHost";
import {
  CompanionHeader,
  companionHeaderDimTargetKey,
  type CompanionHeaderDimTargetRegistration,
  type CompanionHeaderProps,
} from "./CompanionHeader";

function props(overrides: Partial<CompanionHeaderProps> = {}): CompanionHeaderProps {
  return {
    connection: "live",
    muted: false,
    volume: 0.4,
    mode: "full",
    textScale: 1,
    texture: 1,
    canReplay: true,
    toggleMute: vi.fn(),
    setVolume: vi.fn(),
    cycleMotion: vi.fn(),
    setTextScale: vi.fn(),
    setTexture: vi.fn(),
    replay: vi.fn(),
    ...overrides,
  };
}

describe("CompanionHeader animation boundary", () => {
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

  it("keeps the semantic header and controls outside GSAP ownership", () => {
    const toggleMute = vi.fn();
    const cycleMotion = vi.fn();
    const view = render(<CompanionHeader {...props({ mode: "reduced", toggleMute, cycleMotion })} />);

    const header = screen.getByRole("banner");
    const dim = header.querySelector<HTMLElement>(`[data-scene-part="${companionHeaderDimTargetKey}"]`);
    expect(dim).not.toBeNull();
    expect(header.querySelectorAll(`[data-scene-part="${companionHeaderDimTargetKey}"]`)).toHaveLength(1);
    expect(dim).toHaveAttribute("aria-hidden", "true");
    expect(dim).toHaveAttribute("data-runtime-boundary", "gsap");
    expect(dim).not.toHaveAttribute("data-animation-owner");
    expect(dim).not.toHaveAttribute("data-gsap-owned");
    expect(dim).toHaveStyle({ position: "absolute", pointerEvents: "none", opacity: 0 });
    expect(header).not.toHaveAttribute("data-gsap-owned");
    expect(header).not.toHaveAttribute("data-scene-part");
    expect(view.container.querySelector('[data-scene-part="peripheral"]')).toBeNull();
    expect(header.querySelector("button[data-gsap-owned]")).toBeNull();

    expect(screen.getByText("Connected")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
    fireEvent.click(screen.getByRole("button", { name: "Motion: reduced. Change motion setting" }));
    expect(toggleMute).toHaveBeenCalledOnce();
    expect(cycleMotion).toHaveBeenCalledOnce();
  });

  it("registers one host-local target and exports only a registry-minted handle", async () => {
    let registration: CompanionHeaderDimTargetRegistration | null = null;
    const onDimTargetChange = vi.fn((next: CompanionHeaderDimTargetRegistration | null) => {
      registration = next;
    });
    const view = render(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="companion-header-test">
          <CompanionHeader {...props({ onDimTargetChange })} />
        </SceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => expect(registration).not.toBeNull());
    const current = registration as CompanionHeaderDimTargetRegistration | null;
    if (!current) throw new Error("Companion header dim target was not registered");
    const dim = view.container.querySelector<HTMLElement>(`[data-scene-part="${companionHeaderDimTargetKey}"]`);
    expect(dim?.dataset.sceneTargetId).toBe(current.target.targetId);
    expect(dim).not.toHaveAttribute("data-animation-owner");
    expect(dim).not.toHaveAttribute("data-gsap-owned");
    expect(current.key).toBe(companionHeaderDimTargetKey);
    expect(current.target.part).toBe(companionHeaderDimTargetKey);

    const external = current.exportForScene({
      allowedProperties: ["opacity"],
      lifetime: "handoff",
    });
    expect(external.targetId).toBe(current.target.targetId);
    expect(external.sourceHostId).toBe(current.target.hostId);
    expect(external.allowedProperties).toEqual(["opacity"]);
    expect(external.externalTargetId).toMatch(/^external-/u);

    let replacementRegistration: CompanionHeaderDimTargetRegistration | null = null;
    const replacementConsumer = vi.fn((next: CompanionHeaderDimTargetRegistration | null) => {
      replacementRegistration = next;
    });
    view.rerender(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="companion-header-test">
          <CompanionHeader {...props({ onDimTargetChange: replacementConsumer })} />
        </SceneHost>
      </AnimationProvider>,
    );
    await waitFor(() => expect(replacementRegistration).toBe(current));
    expect(onDimTargetChange).toHaveBeenLastCalledWith(null);

    view.unmount();
    expect(replacementConsumer).toHaveBeenLastCalledWith(null);
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useAnimationAuthority, useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import type { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { phase3PlayerProgressEventTypes } from "./contracts";
import {
  ProgressionSceneHost,
  progressionRelevantTargetParts,
  progressionSceneHostKey,
  progressionSceneTargetParts,
} from "./ProgressionSceneHost";

function RegistryCapture({ onChange }: { onChange: (registry: SceneHostRegistry) => void }) {
  onChange(useAnimationAuthority().hosts);
  return null;
}

function NestedTarget({ onHostChange }: { onHostChange: (host: SceneHostHandle | null) => void }) {
  const host = useOptionalSceneHost();
  const input = useMemo(
    () => ({
      targetKey: "nested:workspace-light",
      part: "workspace-light",
      ownerHint: "gsap" as const,
      allowedProperties: ["opacity" as const],
    }),
    [],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  onHostChange(host);
  return <div ref={bindTarget} data-testid="nested-target" data-target-id={handle?.targetId ?? "pending"} />;
}

function StatefulContent() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" data-testid="stateful-content" onClick={() => setCount((value) => value + 1)}>
      Voyage state {count}
    </button>
  );
}

const baseProps = {
  content: <button type="button">Continue voyage</button>,
  active: true,
  presentationId: "event-7",
  eventType: "CHAPTER_RELEASED",
  status: "presenting",
  title: "A chapter wakes",
  summary: <p>The seventh course is ready.</p>,
  announcement: "New chapter ready",
} as const;

describe("ProgressionSceneHost", () => {
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

  it("forwards Player journal state and presentation attributes to the persistent host root", () => {
    render(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          as="main"
          className="voyage-shell"
          data-journal-phase="JOURNAL_READY"
          data-journal-speed={0.5}
          data-motion-mode="gentle"
          style={{ "--player-text-scale": 1.1 } as React.CSSProperties}
        />
      </AnimationProvider>,
    );

    const host = screen.getByTestId("progression-scene-host");
    expect(host.tagName).toBe("MAIN");
    expect(host).toHaveClass("voyage-shell");
    expect(host).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    expect(host).toHaveAttribute("data-journal-speed", "0.5");
    expect(host).toHaveAttribute("data-motion-mode", "gentle");
    expect(host).toHaveStyle({ "--player-text-scale": "1.1" });
  });

  it("keeps one stable player-progression authority while active state and presentation children change", async () => {
    const handles: Array<SceneHostHandle | null> = [];
    const onHostChange = (host: SceneHostHandle | null) => handles.push(host);
    const view = render(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} active={false} content={<StatefulContent />} onHostChange={onHostChange}>
          <span data-testid="event-object">first</span>
        </ProgressionSceneHost>
      </AnimationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Voyage state 0" }));
    expect(screen.getByTestId("stateful-content")).toHaveTextContent("Voyage state 1");
    await waitFor(() => expect(handles.find((handle) => handle !== null)).toBeDefined());
    const firstHost = handles.find((handle): handle is SceneHostHandle => handle !== null)!;
    expect(firstHost.kind).toBe("player-progression");
    expect(firstHost.hostId).toContain(progressionSceneHostKey);

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          content={<StatefulContent />}
          presentationId="event-8"
          title="A map changes"
          onHostChange={onHostChange}
        >
          <span data-testid="event-object">second</span>
        </ProgressionSceneHost>
      </AnimationProvider>,
    );

    expect(screen.getByTestId("progression-scene-overlay")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("stateful-content")).toHaveTextContent("Voyage state 1");
    const currentHost = [...handles].reverse().find((handle): handle is SceneHostHandle => handle !== null)!;
    expect(currentHost).toBe(firstHost);

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          active={false}
          content={<StatefulContent />}
          presentationId="event-8"
          title="A map changes"
          onHostChange={onHostChange}
        >
          <span data-testid="event-object">second</span>
        </ProgressionSceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("event-object")).toHaveTextContent("second"));
    expect(screen.getByTestId("stateful-content")).toHaveTextContent("Voyage state 1");
    fireEvent.click(screen.getByRole("button", { name: "Voyage state 1" }));
    expect(screen.getByTestId("stateful-content")).toHaveTextContent("Voyage state 2");
    expect([...handles].reverse().find((handle): handle is SceneHostHandle => handle !== null)).toBe(firstHost);
    expect(screen.getByTestId("progression-scene-overlay")).toHaveAttribute("data-presentation-id", "event-8");

    view.unmount();
    expect(handles.at(-1)).toBeNull();
    expect(firstHost.snapshot()).toMatchObject({ connected: false, registeredTargetCount: 0 });
  });

  it("provides one readable heading, one controlled polite live region, and keyboard-native controls", async () => {
    const skip = vi.fn();
    const replay = vi.fn();
    const open = vi.fn();
    render(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          busy
          skip={{ label: "Skip ceremony", onActivate: skip }}
          replay={{ label: "Replay ceremony", onActivate: replay }}
          destination={{ label: "Open chapter", onActivate: open }}
        />
      </AnimationProvider>,
    );

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "A chapter wakes" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("New chapter ready");
    expect(screen.getByRole("dialog", { name: "A chapter wakes" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("dialog", { name: "A chapter wakes" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("group", { name: "Presentation controls" })).toBeVisible();

    const buttons = within(screen.getByRole("group", { name: "Presentation controls" })).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Skip ceremony", "Replay ceremony", "Open chapter"]);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Skip ceremony" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Skip ceremony" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay ceremony" }));
    fireEvent.click(screen.getByRole("button", { name: "Open chapter" }));
    expect(skip).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });

  it("moves focus on each activation to the first enabled action, then to the event heading", async () => {
    const action = vi.fn();
    const view = render(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          skip={{ label: "Skip ceremony", onActivate: action, disabled: true }}
          destination={{ label: "Open chapter", onActivate: action }}
        />
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Open chapter" })).toHaveFocus());
    expect(screen.getByTestId("progression-content")).toHaveAttribute("inert");

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} active={false} />
      </AnimationProvider>,
    );
    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} />
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "A chapter wakes" })).toHaveFocus());
  });

  it("cycles Tab within enabled visible controls and guards focus from escaping the active modal", async () => {
    const action = vi.fn();
    const outside = document.createElement("button");
    outside.textContent = "Outside control";
    document.body.append(outside);
    const view = render(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          skip={{ label: "Skip ceremony", onActivate: action }}
          replay={{ label: "Replay ceremony", onActivate: action }}
          destination={{ label: "Open chapter", onActivate: action }}
        />
      </AnimationProvider>,
    );

    const skip = screen.getByRole("button", { name: "Skip ceremony" });
    const replay = screen.getByRole("button", { name: "Replay ceremony" });
    const destination = screen.getByRole("button", { name: "Open chapter" });
    await waitFor(() => expect(skip).toHaveFocus());

    destination.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(skip).toHaveFocus();
    skip.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(destination).toHaveFocus();

    skip.hidden = true;
    outside.focus();
    expect(replay).toHaveFocus();

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          presentationId="replacement-event"
          skip={{ label: "Skip ceremony", onActivate: action, disabled: true }}
          replay={{ label: "Replay ceremony", onActivate: action }}
          destination={{ label: "Open chapter", onActivate: action, disabled: true }}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay ceremony" })).toHaveFocus());

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          active={false}
          presentationId="replacement-event"
          skip={{ label: "Skip ceremony", onActivate: action, disabled: true }}
          replay={{ label: "Replay ceremony", onActivate: action }}
          destination={{ label: "Open chapter", onActivate: action, disabled: true }}
        />
      </AnimationProvider>,
    );
    outside.focus();
    expect(outside).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(outside).toHaveFocus();

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          presentationId="unmount-event"
          replay={{ label: "Replay ceremony", onActivate: action }}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay ceremony" })).toHaveFocus());
    view.unmount();
    outside.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it("supports polite, assertive, and off announcement policies without stale inactive text", () => {
    const view = render(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} />
      </AnimationProvider>,
    );
    const liveLayer = screen
      .getByTestId("progression-scene-overlay")
      .querySelector('[data-progression-layer="live-region"]')!;
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(liveLayer).toHaveTextContent("New chapter ready");

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} active={false} politeness="assertive" announcement="Urgent update" />
      </AnimationProvider>,
    );
    expect(liveLayer).toHaveTextContent("");
    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} politeness="assertive" announcement="Urgent update" />
      </AnimationProvider>,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).toHaveTextContent("Urgent update");

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} active={false} politeness="off" announcement="Silent update" />
      </AnimationProvider>,
    );
    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} politeness="off" announcement="Silent update" />
      </AnimationProvider>,
    );
    expect(liveLayer).not.toHaveAttribute("role");
    expect(liveLayer).not.toHaveAttribute("aria-live");
    expect(liveLayer).toHaveTextContent("");
  });

  it.each(phase3PlayerProgressEventTypes)(
    "marks only the relevant persistent targets as visible for %s",
    (eventType) => {
      render(
        <AnimationProvider>
          <ProgressionSceneHost {...baseProps} eventType={eventType}>
            <span data-testid="typed-event-child">Event flourish</span>
          </ProgressionSceneHost>
        </AnimationProvider>,
      );

      const overlay = screen.getByTestId("progression-scene-overlay");
      expect(overlay).toHaveAttribute("data-presentation-event", eventType);
      const expectedParts = progressionRelevantTargetParts[eventType];
      expectedParts.forEach((part) => {
        const matchingTargets = overlay.querySelectorAll(`[data-scene-part="${part}"]`);
        expect(matchingTargets.length).toBeGreaterThan(0);
        matchingTargets.forEach((target) => expect(target).toHaveAttribute("data-presentation-relevance", "relevant"));
      });

      const allTargets = overlay.querySelectorAll("[data-scene-part][data-presentation-relevance]");
      const relevantTargets = overlay.querySelectorAll('[data-scene-part][data-presentation-relevance="relevant"]');
      const neutralTargets = overlay.querySelectorAll('[data-scene-part][data-presentation-relevance="neutral"]');
      expect(relevantTargets.length).toBeGreaterThan(0);
      expect(relevantTargets.length).toBeLessThan(allTargets.length);
      expect(neutralTargets.length).toBeGreaterThan(0);

      const dimmedNeutralTargets = overlay.querySelectorAll(
        '[data-scene-part][data-presentation-relevance="neutral"][data-neutral-visibility="dim"]',
      );
      expect(dimmedNeutralTargets.length).toBeGreaterThan(0);
      dimmedNeutralTargets.forEach((target) =>
        expect(target).toHaveAttribute("data-presentation-relevance", "neutral"),
      );
      expect(overlay.querySelector("[data-presentation-event-children]")).toHaveAttribute(
        "data-presentation-relevance",
        "relevant",
      );

      if (eventType === "FINALE_TEASED" || eventType === "FINALE_REQUIREMENT_UPDATED") {
        ["finale-ring-outer", "finale-ring-inner"].forEach((part) => {
          const ring = overlay.querySelector(`[data-scene-part="${part}"]`)!;
          expect(ring).toHaveAttribute("data-presentation-relevance", "relevant");
          expect(ring).not.toHaveAttribute("data-presentation-relevance", "neutral");
        });
      }
    },
  );

  it("keeps unknown event visuals neutral while retaining a readable summary", () => {
    render(
      <AnimationProvider>
        <ProgressionSceneHost {...baseProps} eventType="FUTURE_EVENT">
          <span>Future flourish</span>
        </ProgressionSceneHost>
      </AnimationProvider>,
    );
    const overlay = screen.getByTestId("progression-scene-overlay");
    expect(overlay).toHaveAttribute("data-presentation-event", "FUTURE_EVENT");
    expect(overlay.querySelectorAll('[data-scene-part][data-presentation-relevance="relevant"]')).toHaveLength(0);
    expect(overlay.querySelector("[data-presentation-event-children]")).toHaveAttribute(
      "data-presentation-relevance",
      "neutral",
    );
    expect(screen.getByRole("heading", { name: "A chapter wakes" })).toBeVisible();
  });

  it("keeps decorative layers hidden while inactive application content stays visible and interactive", () => {
    const continueVoyage = vi.fn();
    const view = render(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          content={
            <button type="button" onClick={continueVoyage}>
              Continue voyage
            </button>
          }
        />
      </AnimationProvider>,
    );

    const host = screen.getByTestId("progression-scene-host");
    const overlay = screen.getByTestId("progression-scene-overlay");
    const content = host.querySelector("[data-progression-content]")!;
    expect(content).toHaveAttribute("inert");
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "Continue voyage" })).not.toBeInTheDocument();
    expect(overlay.querySelector('[data-progression-layer="backdrop"]')).toHaveAttribute("aria-hidden", "true");
    expect(overlay.querySelector('[data-progression-layer="primary"]')).toHaveAttribute("aria-hidden", "true");
    expect(overlay.querySelector('[data-progression-layer="object"]')).toHaveAttribute("aria-hidden", "true");
    expect(overlay.querySelectorAll("[data-scene-part]").length).toBeGreaterThanOrEqual(
      progressionSceneTargetParts.length,
    );

    view.rerender(
      <AnimationProvider>
        <ProgressionSceneHost
          {...baseProps}
          active={false}
          announcement="This must not announce"
          content={
            <button type="button" onClick={continueVoyage}>
              Continue voyage
            </button>
          }
        />
      </AnimationProvider>,
    );
    expect(host).not.toHaveAttribute("hidden");
    expect(host).not.toHaveAttribute("inert");
    expect(host).not.toHaveAttribute("aria-hidden");
    expect(content).not.toHaveAttribute("inert");
    expect(content).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button", { name: "Continue voyage" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue voyage" }));
    expect(continueVoyage).toHaveBeenCalledOnce();
    expect(overlay).toHaveAttribute("hidden");
    expect(overlay).toHaveAttribute("inert");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveAttribute("data-progression-state", "inactive");
    expect(overlay.querySelector('[role="status"]')).toHaveTextContent("");
  });

  it("registers and cleans up exact host-local handles without selecting through a nested host", async () => {
    let registry: SceneHostRegistry | null = null;
    let outerHost: SceneHostHandle | null = null;
    let nestedHost: SceneHostHandle | null = null;
    const view = render(
      <AnimationProvider>
        <RegistryCapture onChange={(next) => (registry = next)} />
        <ProgressionSceneHost {...baseProps} onHostChange={(next) => (outerHost = next)} />
      </AnimationProvider>,
    );

    await waitFor(() => expect(outerHost).not.toBeNull());
    await waitFor(() => expect(outerHost!.snapshot().registeredTargetCount).toBeGreaterThan(0));
    const outerTargetCount = outerHost!.snapshot().registeredTargetCount;
    expect(registry!.snapshot().registeredHostCount).toBe(1);

    view.rerender(
      <AnimationProvider>
        <RegistryCapture onChange={(next) => (registry = next)} />
        <ProgressionSceneHost {...baseProps} onHostChange={(next) => (outerHost = next)}>
          <SceneHost kind="player-section-enhancement" hostKey="nested-section">
            <NestedTarget onHostChange={(next) => (nestedHost = next)} />
          </SceneHost>
        </ProgressionSceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("nested-target")).not.toHaveAttribute("data-target-id", "pending"));
    expect(nestedHost).not.toBeNull();
    expect(nestedHost!.hostId).not.toBe(outerHost!.hostId);
    expect(screen.getByTestId("nested-target").dataset.targetId).toContain(nestedHost!.hostId);
    expect(outerHost!.snapshot().registeredTargetCount).toBe(outerTargetCount);

    view.unmount();
    expect(registry!.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeClaimCount: 0,
    });
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationOwnershipRegistry } from "@/animation/core/ownership";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { PublicSnapshot } from "@/domain/story";
import { ShipsLog, type ShipsLogTargetRegistration } from "./ShipsLog";

const log: PublicSnapshot["log"] = [
  {
    key: "progress-17",
    sequence: 17,
    title: "The chart changed",
    summary: "A new course appeared beyond Lantern Harbor.",
    timestamp: "2026-07-18T15:30:00.000Z",
    symbol: "✦",
    importance: "major",
    section: "chart",
    targetKey: "harbor-to-cove",
    unseen: true,
  },
  {
    key: "progress-16",
    sequence: 16,
    title: "A sealed line",
    summary: "The journal preserved the captain's earlier note.",
    timestamp: "2026-07-18T14:00:00.000Z",
    symbol: "◇",
    importance: "quiet",
    section: "journal",
    unseen: false,
  },
];

const snapshot: PublicSnapshot = {
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "ACTIVE" },
  sequence: 17,
  chapter: { ordinal: 1, state: "ACTIVE", title: "First Light", hints: [] },
  chapters: [],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [],
  sideQuest: null,
  log,
  finale: { state: "LOCKED", requirements: [], unseen: false },
  unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 1, finale: 0 },
};

describe("ShipsLog animation boundary", () => {
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

  it("keeps Motion ownership on the semantic row and registers separate GSAP ink and symbol children", async () => {
    const registrations: ShipsLogTargetRegistration[] = [];
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog
          snapshot={snapshot}
          navigate={navigate}
          progressEntryKey="progress-17"
          onTargetRegistrationChange={(registration) => registrations.push(registration)}
        />
      </AnimationProvider>,
    );

    const row = view.container.querySelector<HTMLElement>('[data-log-entry-key="progress-17"]');
    const ink = view.container.querySelector<HTMLElement>('[data-log-ink-key="progress-17"]');
    const symbol = view.container.querySelector<HTMLElement>('[data-log-symbol-key="progress-17"]');
    expect(row).not.toBeNull();
    expect(ink).not.toBeNull();
    expect(symbol).not.toBeNull();
    expect(row).toHaveAttribute("data-motion-layout-boundary");
    expect(row).not.toHaveAttribute("data-gsap-owned");
    expect(row).toHaveAttribute("data-scene-part", "log-row");
    expect(row?.style.transform).toBe("");
    expect(row?.style.opacity).toBe("");
    expect(ink).toHaveAttribute("data-gsap-visual-boundary");
    expect(ink).not.toHaveAttribute("data-animation-owner");
    expect(ink).toHaveAttribute("data-scene-part", "log-entry-new");
    expect(ink).toHaveAttribute("aria-hidden", "true");
    expect(ink).toHaveStyle({ pointerEvents: "none" });
    expect(symbol).toHaveAttribute("data-scene-part", "log-symbol-new");
    expect(symbol).toHaveAttribute("aria-hidden", "true");

    await waitFor(() => expect(row).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(row).toHaveAttribute("data-animation-owner", "motion"));
    expect(row).toHaveAttribute("data-motion-ownership", "ready");
    expect(view.container.querySelector('[data-log-day-key="2026-07-18"]')).toHaveAttribute(
      "data-motion-ownership",
      "ready",
    );
    await waitFor(() => expect(ink).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(symbol).toHaveAttribute("data-scene-target-id"));
    await waitFor(() =>
      expect(
        registrations.some(
          (registration) =>
            registration.kind === "fresh-ink" && registration.key === "progress-17" && registration.handle,
        ),
      ).toBe(true),
    );

    expect(screen.getByText("The chart changed")).toBeVisible();
    expect(screen.getByText("A new course appeared beyond Lantern Harbor.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open chart" }));
    expect(navigate).toHaveBeenCalledWith("chart");
  });

  it("selects the fresh entry by PublicLogEntry key, never by row order", () => {
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEntryKey="progress-16" />
      </AnimationProvider>,
    );

    expect(view.container.querySelector('[data-log-ink-key="progress-16"]')).toHaveAttribute(
      "data-scene-part",
      "log-entry-new",
    );
    expect(view.container.querySelector('[data-log-ink-key="progress-17"]')).toHaveAttribute(
      "data-scene-part",
      "log-entry-ink",
    );

    view.rerender(
      <AnimationProvider>
        <ShipsLog
          snapshot={{ ...snapshot, log: [...snapshot.log].reverse() }}
          navigate={navigate}
          progressEntryKey="progress-16"
        />
      </AnimationProvider>,
    );
    const selected = view.container.querySelectorAll('[data-log-entry-key][data-progress-target="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("data-log-entry-key", "progress-16");
  });

  it("keeps log rows static, readable, and interactive when Motion ownership is denied", () => {
    vi.spyOn(AnimationOwnershipRegistry.prototype, "claim").mockImplementation((request) => ({
      status: "rejected",
      requestedTargetId: request.targetId,
      property: request.properties[0] ?? "layout",
      group: "spatial-transform",
      requestedOwner: request.runtime,
      existingOwner: "gsap",
      reason: "property-conflict",
    }));
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEntryKey="progress-17" />
      </AnimationProvider>,
    );

    const day = view.container.querySelector<HTMLElement>('[data-log-day-key="2026-07-18"]');
    const row = view.container.querySelector<HTMLElement>('[data-log-entry-key="progress-17"]');
    expect(day).toHaveAttribute("data-motion-ownership", "static");
    expect(day).not.toHaveAttribute("data-scene-target-id");
    expect(day).not.toHaveAttribute("data-animation-owner");
    expect(row).toHaveAttribute("data-motion-ownership", "static");
    expect(row).not.toHaveAttribute("data-scene-target-id");
    expect(row).not.toHaveAttribute("data-animation-owner");
    expect(row?.style.transform).toBe("");
    expect(row?.style.opacity).toBe("");
    expect(screen.getByText("The chart changed")).toBeVisible();

    const open = screen.getByRole("button", { name: "Open chart" });
    open.focus();
    fireEvent.click(open);
    expect(open).toHaveFocus();
    expect(navigate).toHaveBeenCalledWith("chart");
  });

  it("preserves stable filtering, focusable navigation, and readable empty output", async () => {
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEntryKey="progress-17" />
      </AnimationProvider>,
    );

    const filter = screen.getByRole("combobox", { name: "Show" });
    fireEvent.change(filter, { target: { value: "journal" } });
    expect(screen.getByText("A sealed line")).toBeVisible();
    expect(screen.queryByText("The chart changed")).toBeNull();
    const journalButton = screen.getByRole("button", { name: "Open journal" });
    journalButton.focus();
    expect(journalButton).toHaveFocus();

    fireEvent.change(filter, { target: { value: "all" } });
    await waitFor(() => expect(screen.getByText("The chart changed")).toBeVisible());

    view.rerender(
      <AnimationProvider>
        <ShipsLog snapshot={{ ...snapshot, log: [] }} navigate={navigate} />
      </AnimationProvider>,
    );
    expect(screen.getByRole("heading", { name: "The log awaits its first line" })).toBeVisible();
    expect(screen.getByText(/Released voyage events will be recorded/)).toBeVisible();
  });
});

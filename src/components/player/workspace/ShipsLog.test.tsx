import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationOwnershipRegistry } from "@/animation/core/ownership";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { PublicSnapshot } from "@/domain/story";
import { ShipsLog, type ShipsLogTargetRegistration } from "./ShipsLog";

const pageFlipProbe = vi.hoisted(() => ({ pages: [] as Array<{ id: string; label: string }> }));

vi.mock("@/components/animation/PageFlipBook", () => ({
  PageFlipBook: ({
    pages,
    bookId,
    revision,
  }: {
    pages: Array<{ id: string; label: string; content: ReactNode }>;
    bookId: string;
    revision: string;
  }) => {
    pageFlipProbe.pages = pages.map(({ id, label }) => ({ id, label }));
    return (
      <div data-pageflip-book={bookId} data-pageflip-revision={revision}>
        {pages.map((page) => (
          <section key={page.id} data-pageflip-page={page.id} aria-label={page.label}>
            {page.content}
          </section>
        ))}
      </div>
    );
  },
}));

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
    sessionStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    vi.restoreAllMocks();
    pageFlipProbe.pages = [];
  });

  it("keeps Motion ownership on the semantic row and registers separate GSAP ink and symbol children", async () => {
    const registrations: ShipsLogTargetRegistration[] = [];
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog
          snapshot={snapshot}
          navigate={navigate}
          progressEventId="progress-17"
          onTargetRegistrationChange={(registration) => registrations.push(registration)}
        />
      </AnimationProvider>,
    );

    const row = view.container.querySelector<HTMLElement>('[data-log-entry-key="progress-17"]');
    const ink = view.container.querySelector<HTMLElement>('[data-log-ink-key="progress-17"]');
    const date = view.container.querySelector<HTMLElement>('[data-log-date-key="progress-17"]');
    const symbol = view.container.querySelector<HTMLElement>('[data-log-symbol-key="progress-17"]');
    expect(row).not.toBeNull();
    expect(ink).not.toBeNull();
    expect(date).not.toBeNull();
    expect(symbol).not.toBeNull();
    expect(row).toHaveAttribute("data-motion-layout-boundary");
    expect(row).not.toHaveAttribute("data-gsap-owned");
    expect(row).toHaveAttribute("data-scene-part", "log-row");
    expect(row?.style.transform).toBe("");
    expect(row?.style.opacity).toBe("");
    expect(ink).toHaveAttribute("data-gsap-visual-boundary");
    expect(ink).not.toHaveAttribute("data-animation-owner");
    expect(ink).toHaveAttribute("data-scene-part", "log-entry-new");
    expect(ink).toHaveAttribute("data-event-id", "progress-17");
    expect(ink).toHaveAttribute("aria-hidden", "true");
    expect(ink).toHaveStyle({ pointerEvents: "none" });
    expect(date).toHaveAttribute("data-scene-part", "log-date-new");
    expect(date).toHaveAttribute("data-event-id", "progress-17");
    expect(date).toHaveAttribute("aria-hidden", "true");
    expect(date).toHaveStyle({ pointerEvents: "none" });
    expect(symbol).toHaveAttribute("data-scene-part", "log-symbol-new");
    expect(symbol).toHaveAttribute("data-event-id", "progress-17");
    expect(symbol).toHaveAttribute("aria-hidden", "true");

    await waitFor(() => expect(row).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(row).toHaveAttribute("data-animation-owner", "motion"));
    expect(row).toHaveAttribute("data-motion-ownership", "ready");
    expect(view.container.querySelector('[data-log-day-key="2026-07-18"]')).toHaveAttribute(
      "data-motion-ownership",
      "ready",
    );
    await waitFor(() => expect(ink).toHaveAttribute("data-scene-target-id"));
    await waitFor(() => expect(date).toHaveAttribute("data-scene-target-id"));
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

  it("labels an offline-recovered entry from authoritative synchronization metadata", () => {
    const offlineSnapshot: PublicSnapshot = {
      ...snapshot,
      log: [
        {
          ...log[0],
          synchronization: {
            source: "offline-recovery",
            synchronizedAt: "2026-07-18T15:35:00.000Z",
          },
        },
        log[1],
      ],
    };
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={offlineSnapshot} navigate={vi.fn()} progressEventId="progress-17" />
      </AnimationProvider>,
    );

    const row = view.container.querySelector<HTMLElement>('[data-log-entry-key="progress-17"]');
    expect(row).toHaveAttribute("data-offline-synchronized", "true");
    expect(row).toHaveAttribute("data-synchronized-at", "2026-07-18T15:35:00.000Z");
    expect(screen.getByText(/Added after reconnect · server synchronized/)).toBeVisible();
  });

  it("renders the server-projected moon phase with an equivalent accessible label", () => {
    render(
      <AnimationProvider>
        <ShipsLog snapshot={{ ...snapshot, log: [{ ...log[0], moonPhase: "full" }, log[1]] }} navigate={vi.fn()} />
      </AnimationProvider>,
    );

    expect(screen.getByLabelText("Moon phase: full")).toHaveAttribute("data-moon-phase", "full");
  });

  it("selects by immutable ProgressEvent id, never by payload target or row order", () => {
    const navigate = vi.fn();
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEventId="harbor-to-cove" />
      </AnimationProvider>,
    );

    expect(view.container.querySelectorAll('[data-log-entry-key][data-progress-target="true"]')).toHaveLength(0);

    view.rerender(
      <AnimationProvider>
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEventId="progress-16" />
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
          progressEventId="progress-16"
        />
      </AnimationProvider>,
    );
    const selected = view.container.querySelectorAll('[data-log-entry-key][data-progress-target="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("data-log-entry-key", "progress-16");
    expect(selected[0]).toHaveAttribute("data-event-id", "progress-16");
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
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEventId="progress-17" />
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
        <ShipsLog snapshot={snapshot} navigate={navigate} progressEventId="progress-17" />
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
    expect(view.container.querySelectorAll('[data-event-id="progress-17"][data-progress-target="true"]')).toHaveLength(
      1,
    );

    view.rerender(
      <AnimationProvider>
        <ShipsLog snapshot={{ ...snapshot, log: [] }} navigate={navigate} />
      </AnimationProvider>,
    );
    expect(screen.getByRole("heading", { name: "Nothing has been recorded yet" })).toBeVisible();
    expect(screen.getByText(/Released Voyage events will appear here without revealing private details/)).toBeVisible();
  });

  it("uses StPageFlip only after history becomes long, keeping chronological day pages and reduced controls readable", () => {
    const longHistory = Array.from({ length: 8 }, (_, index) => ({
      ...log[index % log.length],
      key: `history-${index + 1}`,
      sequence: index + 1,
      timestamp: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      title: `Log day ${index + 1}`,
      unseen: false,
    }));
    const view = render(
      <AnimationProvider>
        <ShipsLog snapshot={{ ...snapshot, sequence: 99, log: longHistory }} navigate={vi.fn()} />
      </AnimationProvider>,
    );

    expect(view.container.querySelector("[data-pageflip-book='ships-log-history']")).toBeInTheDocument();
    expect(pageFlipProbe.pages).toHaveLength(8);
    expect(pageFlipProbe.pages.map((page) => page.id)).toEqual(longHistory.map((entry) => `log-day-${entry.key}`));
    expect(screen.getByRole("heading", { name: "Log day 1" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Open chart" })).not.toHaveLength(0);
  });
});

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { JournalWorkspace, type JournalCeremonyTargetReady } from "./JournalWorkspace";

vi.mock("page-flip", () => ({
  PageFlip: class {
    private current: number;
    private readonly host: HTMLElement;
    constructor(host: HTMLElement, options: { startPage: number }) {
      this.host = host;
      this.current = options.startPage;
    }
    loadFromHTML = (pages: HTMLElement[]) => this.host.replaceChildren(...pages);
    updateFromHtml = (pages: HTMLElement[]) => this.host.replaceChildren(...pages);
    destroy = () => this.host.remove();
    flipNext = vi.fn();
    flipPrev = vi.fn();
    turnToPage = (page: number) => {
      this.current = page;
    };
    flip = (page: number) => {
      this.current = page;
    };
    getCurrentPageIndex = () => this.current;
    getPageCount = () => 4;
    getOrientation = () => "landscape" as const;
    on = vi.fn();
  },
}));

vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: ({ label }: { label: string }) => <div aria-label={label} />,
}));

const chapter: PublicSnapshot["chapter"] = {
  ordinal: 1,
  state: "ACTIVE",
  title: "The Lantern Course",
  narrative: "A safe line of story ink reaches the visible page.",
  objective: "Follow the harmless lanterns.",
  riddle: "Where moonlit ink meets tide.",
  hints: [],
};

const snapshot: PublicSnapshot = {
  campaign: { slug: "journal-boundary-test", title: "Journal Boundary Test", status: "ACTIVE" },
  sequence: 12,
  chapter,
  chapters: [chapter],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [],
  sideQuest: null,
  log: [],
  finale: { state: "LOCKED", requirements: [], unseen: false },
  unseen: { journal: 1, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
};

const chapterRelease: ClientProgressEvent = {
  id: "event-chapter-12",
  type: "CHAPTER_RELEASED",
  sequence: 12,
  releaseAt: "2026-07-18T20:00:00.000Z",
  payload: {
    ordinal: 1,
    title: chapter.title,
    narrative: chapter.narrative,
    objective: chapter.objective,
    riddle: chapter.riddle,
  },
};

describe("JournalWorkspace chapter ceremony host", () => {
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

  it("hands off a live player-progression host only after exact targets are ready and nests PageFlip", async () => {
    const hostChanges: Array<SceneHostHandle | null> = [];
    const targetChanges: Array<JournalCeremonyTargetReady | null> = [];
    const view = render(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={snapshot}
          mode="full"
          activeEvent={chapterRelease}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
          onSceneHostChange={(host) => hostChanges.push(host)}
          onSceneTargetsChange={(ready) => targetChanges.push(ready)}
        />
      </AnimationProvider>,
    );

    await waitFor(() => expect(hostChanges.some(Boolean)).toBe(true));
    const host = hostChanges.findLast((candidate): candidate is SceneHostHandle => candidate !== null)!;
    const ready = targetChanges.findLast((candidate): candidate is JournalCeremonyTargetReady => candidate !== null)!;
    expect(host).toBe(ready.host);
    expect(host.kind).toBe("player-progression");
    expect(host.snapshot()).toMatchObject({ connected: true, registeredTargetCount: 16 });

    expect(Object.fromEntries(Object.entries(ready.targets).map(([part, handles]) => [part, handles.length]))).toEqual({
      "journal-stage": 1,
      "sealed-parchment": 1,
      "ink-heading": 2,
      "ink-story": 1,
      "ink-objective": 1,
      "ink-riddle": 1,
      "page-light": 1,
      seal: 1,
      "seal-crack": 1,
      "seal-fragment": 2,
      "route-path": 1,
      "map-fog": 1,
      quill: 1,
      "quill-path": 1,
    });
    expect(
      Object.values(ready.targets)
        .flat()
        .every((target) => target.hostId === host.hostId),
    ).toBe(true);

    const progressionHost = view.container.querySelector<HTMLElement>(
      '[data-scene-host-boundary="player-progression"]',
    )!;
    const pageFlipHost = view.container.querySelector<HTMLElement>(
      '[data-pageflip-boundary-host="true"][data-scene-host-boundary="player-section-enhancement"]',
    )!;
    const hiddenSource = view.container.querySelector<HTMLElement>(".page-flip-source")!;
    expect(progressionHost).toContainElement(pageFlipHost);
    expect(pageFlipHost).toContainElement(hiddenSource);
    expect(pageFlipHost.getAttribute("data-scene-host-id")).not.toBe(host.hostId);
    expect(hiddenSource).toHaveAttribute("aria-hidden", "true");
    expect(hiddenSource).toHaveAttribute("inert");

    view.rerender(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={snapshot}
          mode="full"
          activeEvent={null}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
          onSceneHostChange={(nextHost) => hostChanges.push(nextHost)}
          onSceneTargetsChange={(nextReady) => targetChanges.push(nextReady)}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(hostChanges.at(-1)).toBeNull());
    expect(targetChanges.at(-1)).toBeNull();
    expect(host.snapshot()).toMatchObject({ connected: true, registeredTargetCount: 1 });

    view.unmount();
    expect(host.snapshot()).toMatchObject({ connected: false, registeredTargetCount: 0 });
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import type { PageFlipPageTargetExportAuthority } from "@/components/animation/PageFlipBook";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import { buildJournalPages } from "@/animation/journal/page-model";
import {
  JournalWorkspace,
  resolveJournalAnnotationTarget,
  type JournalCeremonyTargetReady,
  type JournalChapterInkCommand,
} from "./JournalWorkspace";

const lottieProbe = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  goToFrame: vi.fn(),
  playSegment: vi.fn(),
  setSpeed: vi.fn(),
  setDirection: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("page-flip", () => ({
  PageFlip: class {
    current: number;
    pageCount = 0;
    showCover: boolean;
    host: HTMLElement;
    handlers = new Map<string, (event: { data: number | string }) => void>();
    constructor(host: HTMLElement, options: { startPage: number; showCover: boolean }) {
      this.host = host;
      this.current = options.startPage;
      this.showCover = options.showCover;
    }
    loadFromHTML = (pages: HTMLElement[]) => {
      this.pageCount = pages.length;
      this.current = this.getSpreadAnchor(this.current);
      this.host.replaceChildren(...pages);
    };
    updateFromHtml = (pages: HTMLElement[]) => {
      this.pageCount = pages.length;
      this.host.replaceChildren(...pages);
    };
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
    getPageCount = () => this.pageCount;
    getOrientation = () => "landscape" as const;
    getSpreadIndexByPage = (page: number) => {
      if (page < 0 || page >= this.pageCount) return null;
      if (!this.showCover) return Math.floor(page / 2);
      return page === 0 ? 0 : 1 + Math.floor((page - 1) / 2);
    };
    getSpreadAnchor = (page: number) => {
      if (!this.showCover || page === 0) return page - (page % 2);
      return page % 2 === 0 ? page - 1 : page;
    };
    getPageCollection = () => ({
      getCurrentSpreadIndex: () => this.getSpreadIndexByPage(this.current),
      getSpreadIndexByPage: this.getSpreadIndexByPage,
    });
    on = (name: string, callback: (event: { data: number | string }) => void) => this.handlers.set(name, callback);
  },
}));

vi.mock("@/components/animation/LottieEffect", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    LottieEffect: forwardRef(function LottieEffectMock(
      { label, className }: { label: string; className?: string },
      ref,
    ) {
      useImperativeHandle(ref, () => lottieProbe);
      return (
        <div className={className}>
          <span className="sr-only">{label}</span>
        </div>
      );
    }),
  };
});

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

const annotationEvent: ClientProgressEvent = {
  id: "event-annotation-12",
  type: "JOURNAL_ANNOTATION_ADDED",
  sequence: 13,
  releaseAt: "2026-07-18T20:01:00.000Z",
  payload: { key: "captains-mark", title: "Captain's mark", chapterOrdinal: 1 },
};

function annotationSnapshot(unseen: boolean): PublicSnapshot {
  const annotatedChapter = {
    ...chapter,
    annotations: [
      {
        key: "captains-mark",
        title: "Captain's mark",
        body: "Only this new line of ink should move.",
        createdAt: "2026-07-18T20:01:00.000Z",
        unseen,
      },
    ],
  };
  return { ...snapshot, sequence: unseen ? 13 : 14, chapter: annotatedChapter, chapters: [annotatedChapter] };
}

function annotationTargetAuthority(current: boolean): PageFlipPageTargetExportAuthority {
  const pageId = "chapter-1-annotation-captains-mark";
  return {
    hostId: "annotation-host" as PageFlipPageTargetExportAuthority["hostId"],
    pageFlipInstanceId: "annotation-pageflip",
    cloneGeneration: 2,
    targets: [
      {
        handle: {
          providerId: "provider-test",
          hostId: "annotation-host",
          hostGeneration: 1,
          targetId: "annotation-ink-target",
          part: "annotation-ink",
          targetGeneration: 2,
          release: vi.fn(),
        } as unknown as SceneTargetHandle,
        targetKey: `pageflip:${pageId}:primary:g2:annotation-ink:annotation-captains-mark-ink`,
        pageId,
        part: "annotation-ink",
        generation: 2,
        role: "primary",
        current,
      },
    ],
    exportTarget: vi.fn() as unknown as PageFlipPageTargetExportAuthority["exportTarget"],
  };
}

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
    vi.clearAllMocks();
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

  it("keeps the chapter enhancement readable without competing with the persistent global announcer", async () => {
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
          onSceneTargetsChange={(ready) => targetChanges.push(ready)}
        />
      </AnimationProvider>,
    );

    await waitFor(() => expect(targetChanges.some(Boolean)).toBe(true));
    const enhancement = view.container.querySelector<HTMLElement>(".chapter-ceremony-page")!;
    expect(enhancement).not.toHaveAttribute("role");
    expect(enhancement).not.toHaveAttribute("aria-live");
    expect(enhancement.querySelector('[role="status"]')).toBeNull();
    expect(enhancement.querySelector("[aria-live]")).toBeNull();
    expect(enhancement).toHaveTextContent("The Lantern Course");
    expect(enhancement).toHaveTextContent("A safe line of story ink reaches the visible page.");

    const decoration = enhancement.querySelector<HTMLElement>(".ceremony-ink-bloom-decoration")!;
    expect(decoration).toHaveAttribute("aria-hidden", "true");
    expect(decoration.querySelector(".sr-only")).toHaveTextContent("Ink blooming and drying across the released page");
    const ready = targetChanges.findLast((candidate): candidate is JournalCeremonyTargetReady => candidate !== null);
    expect(ready?.targets["ink-story"]).toHaveLength(1);
  });

  it("selects annotation ink only from the exact current visible PageFlip page capability", () => {
    const pages = buildJournalPages(annotationSnapshot(true)).filter((page) => page.density === "soft");
    expect(resolveJournalAnnotationTarget(annotationEvent, pages, annotationTargetAuthority(false))).toBeNull();

    const ready = resolveJournalAnnotationTarget(annotationEvent, pages, annotationTargetAuthority(true));
    expect(ready).toMatchObject({
      eventId: annotationEvent.id,
      annotationKey: "captains-mark",
      chapterOrdinal: 1,
      pageId: "chapter-1-annotation-captains-mark",
    });
    expect(ready!.target).toMatchObject({ part: "annotation-ink", current: true, role: "primary" });
    expect(ready!.authority.exportTarget).toBeTypeOf("function");
    expect(
      resolveJournalAnnotationTarget(
        { ...annotationEvent, payload: { ...annotationEvent.payload, key: "different-mark" } },
        pages,
        annotationTargetAuthority(true),
      ),
    ).toBeNull();
  });

  it("preserves annotation identity, unseen truth, current page, and control focus across a snapshot update", async () => {
    const view = render(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={annotationSnapshot(true)}
          mode="reduced"
          activeEvent={annotationEvent}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Next journal page" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    const next = screen.getByRole("button", { name: "Next journal page" });
    next.focus();
    const pageBefore = screen.getByText(/Page \d+ of \d+/).textContent;
    const inkBefore = await waitFor(() => {
      const target = view.container.querySelector<HTMLElement>(
        '.reduced-page-stage [data-scene-target-key="annotation:captains-mark:ink"]',
      );
      expect(target).not.toBeNull();
      return target;
    });
    expect(inkBefore).toHaveAttribute("data-annotation-unseen", "true");
    expect(inkBefore).toHaveTextContent("Only this new line of ink should move.");

    view.rerender(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={annotationSnapshot(false)}
          mode="reduced"
          activeEvent={annotationEvent}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
        />
      </AnimationProvider>,
    );
    await waitFor(() =>
      expect(view.container.querySelector('[data-scene-target-key="annotation:captains-mark:ink"]')).toHaveAttribute(
        "data-annotation-unseen",
        "false",
      ),
    );
    expect(screen.getByText(/Page \d+ of \d+/).textContent).toBe(pageBefore);
    expect(document.activeElement).toBe(next);
  });

  it("publishes a command-only chapter ink seam and never plays Lottie on mount", async () => {
    const commands: Array<JournalChapterInkCommand | null> = [];
    const view = render(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={snapshot}
          mode="full"
          activeEvent={chapterRelease}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
          onChapterInkCommandChange={(command) => commands.push(command)}
        />
      </AnimationProvider>,
    );
    await waitFor(() =>
      expect(commands.at(-1)).toMatchObject({ eventId: chapterRelease.id, semanticLabel: "ink-story" }),
    );
    expect(lottieProbe.play).not.toHaveBeenCalled();

    act(() => commands.at(-1)!.play());
    expect(lottieProbe.play).toHaveBeenCalledOnce();

    view.rerender(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={snapshot}
          mode="full"
          activeEvent={null}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
          onChapterInkCommandChange={(command) => commands.push(command)}
        />
      </AnimationProvider>,
    );
    await waitFor(() => expect(commands.at(-1)).toBeNull());
  });

  it("mounts the truthful decorative Journal Clasp fallback and retracts lifecycle-scoped status", async () => {
    const statuses: Array<"loading" | "ready" | "timed-out" | "failed" | "fallback" | "paused" | "hidden" | null> = [];
    const view = render(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={snapshot}
          mode="full"
          activeEvent={chapterRelease}
          openingPhase="LATCH_RELEASING"
          interactive
          playbackRate={1}
          onClaspStatusChange={(status) => statuses.push(status)}
        />
      </AnimationProvider>,
    );

    const contract = view.container.querySelector<HTMLElement>("[data-journal-clasp-contract]");
    expect(contract).not.toBeNull();
    expect(contract).toHaveAttribute("aria-hidden", "true");
    expect(contract).toHaveAttribute("data-rive-contract-availability", "blocked_external_asset");
    expect(contract).toHaveAttribute("data-rive-production-art-status", "blocked_external_asset");
    expect(contract).toHaveAttribute("data-rive-state", "awake");
    expect(contract).toHaveAttribute("data-rive-state-value", "1");
    expect(contract).toHaveAttribute(
      "data-rive-inputs",
      "isHovering,isFocused,openingPhase,pressure,wake,release,open,interrupt,reset,reducedMotion",
    );
    expect(contract).toHaveAttribute(
      "data-rive-reduced-pose",
      JSON.stringify({ openingPhase: 0, pressure: 0, reducedMotion: true }),
    );
    expect(contract).toHaveAttribute("data-rive-reduced-equivalent", "semantic-final-state");
    expect(contract).toHaveStyle({ pointerEvents: "none" });
    expect(contract?.querySelector("img")).toHaveAttribute("src", "/animations/stills/journal-clasp-fallback.svg");
    expect(
      contract?.querySelector("[data-scene-part], [data-scene-target-id], [data-animation-owner], [data-gsap-owned]"),
    ).toBeNull();
    expect(view.container.querySelector(".latch-assembly")).toBeInTheDocument();
    expect(screen.getByText("The journal clasp is awake and ready to release.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next journal page" })).toBeEnabled();
    await waitFor(() => expect(contract).toHaveAttribute("data-rive-runtime-status", "fallback"));
    expect(statuses.at(-1)).toBe("fallback");

    view.rerender(
      <AnimationProvider>
        <JournalWorkspace
          snapshot={{ ...snapshot, sequence: 13 }}
          mode="reduced"
          activeEvent={null}
          openingPhase="JOURNAL_READY"
          interactive
          playbackRate={1}
          onClaspStatusChange={(status) => statuses.push(status)}
        />
      </AnimationProvider>,
    );
    const settled = view.container.querySelector<HTMLElement>("[data-journal-clasp-contract]");
    await waitFor(() => expect(settled).toHaveAttribute("data-rive-runtime-status", "fallback"));
    expect(settled).toHaveAttribute("data-rive-state", "open");
    expect(settled).toHaveAttribute("data-rive-state-value", "4");
    expect(settled).toHaveAttribute("data-rive-reduced-equivalent", "semantic-final-state");
    expect(screen.getByText("The journal clasp is open and the readable journal is ready.")).toBeInTheDocument();
    expect(statuses).toContain(null);
    expect(statuses.at(-1)).toBe("fallback");

    view.unmount();
    expect(statuses.at(-1)).toBeNull();
  });
});

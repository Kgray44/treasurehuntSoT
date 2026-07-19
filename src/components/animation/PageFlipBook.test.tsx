import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "./PageFlipBook";

const calls = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  turnTo: vi.fn(),
  flipTo: vi.fn(),
  constructors: vi.fn(),
  instances: [] as Array<{
    current: number;
    destroyMock: ReturnType<typeof vi.fn>;
    handlers: Map<string, (event: { data: number | string }) => void>;
    host: HTMLElement;
  }>,
  instance: null as null | {
    current: number;
    destroyMock: ReturnType<typeof vi.fn>;
    handlers: Map<string, (event: { data: number | string }) => void>;
    host: HTMLElement;
  },
}));

vi.mock("page-flip", () => ({
  PageFlip: class {
    current = 0;
    destroyMock = vi.fn(() => calls.destroy(this));
    handlers = new Map<string, (event: { data: number | string }) => void>();
    host: HTMLElement;
    constructor(host: HTMLElement, options: { flippingTime: number; startPage: number }) {
      this.host = host;
      this.current = options.startPage;
      calls.constructors(host, options);
      calls.instance = this;
      calls.instances.push(this);
    }
    loadFromHTML = (pages: HTMLElement[]) => {
      calls.load(pages);
      this.host.replaceChildren(...pages.map((page) => page.cloneNode(true)));
    };
    updateFromHtml = (pages: HTMLElement[]) => {
      calls.update(pages);
      this.host.replaceChildren(...pages.map((page) => page.cloneNode(true)));
    };
    destroy = () => {
      this.destroyMock();
      this.host.remove();
    };
    flipNext = (...args: unknown[]) => calls.next(...args);
    flipPrev = (...args: unknown[]) => calls.previous(...args);
    turnToPage = (page: number) => {
      this.current = page;
      calls.turnTo(page);
    };
    flip = (page: number, corner: string) => {
      this.current = page;
      calls.flipTo(page, corner);
    };
    getCurrentPageIndex = () => this.current;
    getPageCount = () => 3;
    getOrientation = () => "landscape" as const;
    on = (name: string, callback: (event: { data: number | string }) => void) => this.handlers.set(name, callback);
  },
}));

const pages: FlipBookPage[] = [
  { id: "one", density: "hard", label: "Cover", content: <h2>Cover</h2> },
  { id: "two", density: "soft", label: "Story", content: <p>Story</p> },
];

describe("PageFlipBook", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    calls.instances.length = 0;
    calls.instance = null;
  });

  it("does not initialize the client-only runtime during server rendering", () => {
    expect(renderToString(<PageFlipBook pages={pages} mode="full" />)).toContain("page-flip-source");
    expect(calls.constructors).not.toHaveBeenCalled();
  });

  it("loads HTML once, updates the existing instance, and destroys on unmount", async () => {
    const { rerender, unmount } = render(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    rerender(
      <PageFlipBook
        pages={[...pages, { id: "three", density: "soft", label: "Back", content: <p>Back</p> }]}
        mode="full"
      />,
    );
    await waitFor(() => expect(calls.update).toHaveBeenCalled());
    expect(calls.constructors).toHaveBeenCalledOnce();
    unmount();
    expect(calls.destroy).toHaveBeenCalledOnce();
  });

  it("refreshes same-page content when the canonical session revision changes", async () => {
    const { rerender } = render(<PageFlipBook pages={pages} mode="full" revision={1} />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    rerender(<PageFlipBook pages={pages} mode="full" revision={2} />);
    await waitFor(() => expect(calls.update).toHaveBeenCalledOnce());
  });

  it("supports keyboard turns, event-driven page/orientation state, and imperative navigation", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const { container } = render(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    const book = container.querySelector<HTMLElement>(".page-flip-book")!;
    fireEvent.keyDown(book, { key: "ArrowRight" });
    fireEvent.keyDown(book, { key: "PageUp" });
    expect(calls.next).toHaveBeenCalledOnce();
    expect(calls.previous).toHaveBeenCalledOnce();

    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    calls.instance!.handlers.get("changeOrientation")?.({ data: "portrait" });
    await waitFor(() => expect(book).toHaveClass("orientation-portrait"));

    ref.current?.turnTo(1);
    ref.current?.flipTo(0);
    expect(calls.turnTo).toHaveBeenCalledWith(1);
    expect(calls.flipTo).toHaveBeenCalledWith(0, "top");
    expect(ref.current?.pageCount()).toBe(3);
    expect(ref.current?.orientation()).toBe("landscape");
  });

  it("queues one programmatic turn while a physical page is already moving", async () => {
    const ref = createRef<PageFlipBookHandle>();
    render(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next journal page" })).toBeDisabled());
    ref.current?.flipTo(1);
    expect(calls.flipTo).not.toHaveBeenCalled();
    calls.instance!.handlers.get("changeState")?.({ data: "read" });
    await waitFor(() => expect(calls.flipTo).toHaveBeenCalledOnce());
    expect(calls.flipTo).toHaveBeenCalledWith(1, "top");
  });

  it("assigns distinct left and right physical page geometry", () => {
    const html = renderToString(<PageFlipBook pages={pages} mode="full" />);
    expect(html).toMatch(/page-side-right[\s\S]*page-side-left/);
  });

  it("scales the page turn duration for slow-motion physical inspection", async () => {
    render(<PageFlipBook pages={pages} mode="full" playbackRate={0.25} />);
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledOnce());
    expect(calls.constructors).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ flippingTime: 4400 }),
    );
  });

  it("recreates a live full-mode book with gentle timing while preserving its page", async () => {
    const { rerender } = render(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledOnce());
    calls.instance!.current = 1;
    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());

    rerender(<PageFlipBook pages={pages} mode="gentle" />);

    await waitFor(() => expect(calls.constructors).toHaveBeenCalledTimes(2));
    expect(calls.constructors.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ flippingTime: 1100 }));
    expect(calls.constructors.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ flippingTime: 620, startPage: 1 }));
    expect(calls.instances[0]?.destroyMock).toHaveBeenCalledOnce();
    expect(calls.instance?.current).toBe(1);
  });

  it("preserves the current page and focus while entering and exiting reduced mode", async () => {
    const { container, rerender } = render(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    calls.instance!.current = 1;
    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    const livePage = container.querySelector<HTMLElement>('.page-flip-host [data-page-index="1"]')!;
    livePage.focus();
    expect(livePage).toHaveFocus();

    rerender(<PageFlipBook pages={pages} mode="reduced" />);

    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    const reducedPage = container.querySelector<HTMLElement>('.reduced-page-stage [data-page-index="1"]')!;
    await waitFor(() => expect(reducedPage).toHaveFocus());
    expect(calls.instances[0]?.destroyMock).toHaveBeenCalledOnce();

    const previous = screen.getByRole("button", { name: "Previous journal page" });
    previous.focus();
    rerender(<PageFlipBook pages={pages} mode="full" />);

    await waitFor(() => expect(calls.constructors).toHaveBeenCalledTimes(2));
    expect(calls.constructors.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ startPage: 1 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous journal page" })).toHaveFocus());
  });

  it("marks the hidden source and strips only source eligibility markers from visible clones", async () => {
    const markedPages: FlipBookPage[] = [
      {
        id: "marked",
        density: "soft",
        label: "Marked",
        content: (
          <div data-pageflip-source data-scene-instance="stale" data-scene-instance-id="also-stale">
            <span data-scene-part="chapter-heading">Readable content</span>
          </div>
        ),
      },
    ];
    const { container } = render(<PageFlipBook pages={markedPages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());

    const hiddenSource = container.querySelector<HTMLElement>(".page-flip-source")!;
    expect(hiddenSource).toHaveAttribute("data-pageflip-source");
    expect(hiddenSource).toHaveAttribute("aria-hidden", "true");
    expect(hiddenSource).toHaveAttribute("inert");
    expect(hiddenSource.querySelector("[data-scene-instance]")).not.toBeNull();

    const suppliedClone = (calls.load.mock.calls[0]?.[0] as HTMLElement[])[0]!;
    expect(suppliedClone.querySelector("[data-pageflip-source]")).toBeNull();
    expect(suppliedClone.querySelector("[data-scene-instance]")).toBeNull();
    expect(suppliedClone.querySelector("[data-scene-instance-id]")).toBeNull();
    expect(suppliedClone.querySelector('[data-scene-part="chapter-heading"]')).toHaveTextContent("Readable content");

    const visibleHost = container.querySelector<HTMLElement>(".page-flip-host")!;
    expect(visibleHost.querySelector("[data-pageflip-source]")).toBeNull();
    expect(visibleHost.querySelector("[data-scene-instance]")).toBeNull();
    expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-animation-owner", "page-flip");
  });

  it("destroys every runtime instance exactly once across policy transitions and unmount", async () => {
    const { rerender, unmount } = render(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instances).toHaveLength(1));
    rerender(<PageFlipBook pages={pages} mode="gentle" />);
    await waitFor(() => expect(calls.instances).toHaveLength(2));
    rerender(<PageFlipBook pages={pages} mode="reduced" />);
    await waitFor(() => expect(calls.instances[1]?.destroyMock).toHaveBeenCalledOnce());
    rerender(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instances).toHaveLength(3));
    unmount();

    expect(calls.instances).toHaveLength(3);
    for (const pageFlip of calls.instances) expect(pageFlip.destroyMock).toHaveBeenCalledOnce();
    expect(calls.destroy).toHaveBeenCalledTimes(3);
  });

  it("uses an immediate accessible fallback and keyboard-independent controls in reduced mode", () => {
    render(<PageFlipBook pages={pages} mode="reduced" />);
    expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    expect(screen.getByText("Story")).toBeVisible();
    expect(calls.load).not.toHaveBeenCalled();
  });
});

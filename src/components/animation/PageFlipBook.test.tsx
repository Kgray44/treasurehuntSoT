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
  instance: null as null | { current: number; handlers: Map<string, (event: { data: number | string }) => void> },
}));

vi.mock("page-flip", () => ({
  PageFlip: class {
    current = 0;
    handlers = new Map<string, (event: { data: number | string }) => void>();
    constructor() {
      calls.constructors();
      calls.instance = this;
    }
    loadFromHTML = calls.load;
    updateFromHtml = calls.update;
    destroy = calls.destroy;
    flipNext = calls.next;
    flipPrev = calls.previous;
    turnToPage = calls.turnTo.mockImplementation((page: number) => (this.current = page));
    flip = calls.flipTo.mockImplementation((page: number) => (this.current = page));
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

  it("uses an immediate accessible fallback and keyboard-independent controls in reduced mode", () => {
    render(<PageFlipBook pages={pages} mode="reduced" />);
    expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    expect(screen.getByText("Story")).toBeVisible();
    expect(calls.load).not.toHaveBeenCalled();
  });
});

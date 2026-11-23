import { expect, it, vi } from "vitest";
import { focusExchangeHeading } from "./focus-exchange-heading";

it("keeps the focused review clear when the masthead changes height after focus", () => {
  document.body.innerHTML = `
    <div class="product-shell">
      <header class="product-shell-header"></header>
      <h2 tabindex="-1">Review before submitting</h2>
    </div>`;
  document.documentElement.style.fontSize = "16px";
  const masthead = document.querySelector("header")!;
  const heading = document.querySelector("h2")!;
  const frames: FrameRequestCallback[] = [];
  const requestFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => frames.push(callback));
  const scrollWindow = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  let mastheadHeight = 80;
  let headingTop = 400;
  masthead.getBoundingClientRect = () => new DOMRect(0, 0, 1440, mastheadHeight);
  heading.getBoundingClientRect = () => new DOMRect(0, headingTop, 400, 30);
  const scrollHeading = vi.fn(() => {
    headingTop = Number.parseFloat(heading.style.scrollMarginBlockStart);
  });
  heading.scrollIntoView = scrollHeading;
  try {
    focusExchangeHeading(heading);
    frames.shift()!(0);
    expect(document.activeElement).toBe(heading);
    expect(headingTop).toBe(96);

    mastheadHeight = 120;
    frames.shift()!(16);
    expect(headingTop).toBe(136);
  } finally {
    requestFrame.mockRestore();
    scrollWindow.mockRestore();
    document.documentElement.style.removeProperty("font-size");
    document.body.replaceChildren();
  }
});

it("keeps the focused review visible when the form reflows after the initial scroll", () => {
  document.body.innerHTML = `
    <div class="product-shell">
      <header class="product-shell-header"></header>
      <section class="studio-exchange-workflow">
        <h2 tabindex="-1">Review before submitting</h2>
      </section>
    </div>`;
  document.documentElement.style.fontSize = "16px";
  const masthead = document.querySelector("header")!;
  const heading = document.querySelector("h2")!;
  const frames: FrameRequestCallback[] = [];
  const requestFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => frames.push(callback));
  let resize: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  let headingTop = 400;
  masthead.getBoundingClientRect = () => new DOMRect(0, 0, 1440, 112);
  heading.getBoundingClientRect = () => new DOMRect(0, headingTop, 400, 27);
  const scroll = vi.fn(() => {
    headingTop = Number.parseFloat(heading.style.scrollMarginBlockStart);
  });
  heading.scrollIntoView = scroll;
  try {
    focusExchangeHeading(heading);
    frames.shift()!(0);
    frames.shift()!(16);
    expect(headingTop).toBe(128);

    headingTop -= 24;
    resize?.();
    while (frames.length) frames.shift()!(32);
    expect(headingTop).toBe(128);
    heading.blur();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    heading.blur();
    requestFrame.mockRestore();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("font-size");
    document.body.replaceChildren();
  }
});

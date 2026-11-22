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

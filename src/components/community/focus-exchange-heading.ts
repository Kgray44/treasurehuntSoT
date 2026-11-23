export function focusExchangeHeading(heading: HTMLHeadingElement) {
  const viewport = heading.ownerDocument.defaultView;
  const masthead = heading.closest(".product-shell")?.querySelector(":scope > .product-shell-header");
  heading.focus({ preventScroll: true });
  if (!masthead || !viewport) {
    heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    return;
  }
  const documentRoot = heading.ownerDocument.documentElement;
  const clearance = () =>
    Math.max(0, masthead.getBoundingClientRect().bottom) +
    Number.parseFloat(viewport.getComputedStyle(documentRoot).fontSize);
  const align = (offset: number) => {
    heading.style.scrollMarginBlockStart = `${offset}px`;
    heading.scrollIntoView?.({ block: "start", behavior: "instant" });
  };
  const isFocused = () => heading.ownerDocument.activeElement === heading;
  const keepClear = () => {
    if (!isFocused()) return;
    const offset = clearance();
    if (heading.getBoundingClientRect().top < offset - 1) align(offset);
  };
  viewport.requestAnimationFrame(() => {
    if (!isFocused()) return;
    align(clearance());
    viewport.requestAnimationFrame(keepClear);
  });

  const form = heading.closest(".studio-exchange-workflow");
  if (!form || typeof ResizeObserver === "undefined") return;
  // The review can settle a line higher after responsive layout catches up.
  // Observe during the focus handoff so later reading and scrolling stay free.
  const observer = new ResizeObserver(keepClear);
  const stop = () => {
    observer.disconnect();
    viewport.clearTimeout(handoff);
    heading.removeEventListener("blur", stop);
  };
  const handoff = viewport.setTimeout(stop, 500);
  heading.addEventListener("blur", stop, { once: true });
  observer.observe(form);
  observer.observe(masthead);
}

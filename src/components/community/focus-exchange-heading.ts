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
  viewport.requestAnimationFrame(() => {
    if (heading.ownerDocument.activeElement !== heading) return;
    align(clearance());
    viewport.requestAnimationFrame(() => {
      if (heading.ownerDocument.activeElement !== heading) return;
      const offset = clearance();
      if (heading.getBoundingClientRect().top < offset - 1) align(offset);
    });
  });
}

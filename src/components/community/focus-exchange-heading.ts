export function focusExchangeHeading(heading: HTMLHeadingElement) {
  const viewport = heading.ownerDocument.defaultView;
  const masthead = heading.closest(".product-shell")?.querySelector(":scope > .product-shell-header");
  heading.focus({ preventScroll: true });
  if (!masthead || !viewport) {
    heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    return;
  }
  const documentRoot = heading.ownerDocument.documentElement;
  viewport.requestAnimationFrame(() => {
    if (heading.ownerDocument.activeElement !== heading) return;
    const padding = Number.parseFloat(viewport.getComputedStyle(documentRoot).fontSize);
    const top = viewport.scrollY + heading.getBoundingClientRect().top - masthead.getBoundingClientRect().bottom;
    viewport.scrollTo({ top: top - padding, behavior: "instant" });
  });
}

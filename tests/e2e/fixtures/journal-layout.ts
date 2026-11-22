import { expect, type Locator, type Page } from "@playwright/test";

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Geometry = {
  failures: string[];
  viewport: Rect;
  textRects: Rect[];
  obstacles: { name: string; rect: Rect }[];
  readingArea?: Rect;
  minimumReadingArea?: { width: number; height: number };
};

// This callback is serialized into the browser. Keep its geometry helpers self-contained.
function measureJournalGeometry(
  element: Element,
  input: { kind: "phone" | "receipt"; expectedText: string },
): Geometry {
  const failures: string[] = [];
  const rect = (value: DOMRect | Rect): Rect => ({
    left: value.left,
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    width: value.right - value.left,
    height: value.bottom - value.top,
  });
  const box = (left: number, top: number, right: number, bottom: number): Rect =>
    rect({ left, top, right, bottom, width: right - left, height: bottom - top });
  const intersect = (a: Rect, b: Rect): Rect =>
    box(Math.max(a.left, b.left), Math.max(a.top, b.top), Math.min(a.right, b.right), Math.min(a.bottom, b.bottom));
  const positive = (value: Rect) => value.width > 0 && value.height > 0;
  const contains = (outer: Rect, inner: Rect) =>
    inner.left >= outer.left - 1 &&
    inner.top >= outer.top - 1 &&
    inner.right <= outer.right + 1 &&
    inner.bottom <= outer.bottom + 1;
  const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();
  const painted = (target: Element) => {
    for (let current: Element | null = target; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return positive(rect(target.getBoundingClientRect()));
  };
  const visual = window.visualViewport;
  const left = visual?.offsetLeft ?? 0,
    top = visual?.offsetTop ?? 0;
  const viewport = box(left, top, left + (visual?.width ?? innerWidth), top + (visual?.height ?? innerHeight));
  const clipToAncestors = (target: Element, initial: Rect) => {
    let clipped = initial;
    for (let current = target.parentElement; current; current = current.parentElement) {
      const style = getComputedStyle(current),
        bounds = rect(current.getBoundingClientRect());
      if (/^(?:auto|scroll|hidden|clip)$/u.test(style.overflowX))
        clipped = box(
          Math.max(clipped.left, bounds.left),
          clipped.top,
          Math.min(clipped.right, bounds.right),
          clipped.bottom,
        );
      if (/^(?:auto|scroll|hidden|clip)$/u.test(style.overflowY))
        clipped = box(
          clipped.left,
          Math.max(clipped.top, bounds.top),
          clipped.right,
          Math.min(clipped.bottom, bounds.bottom),
        );
    }
    return clipped;
  };
  const hitFailure = (target: Element, value: Rect, description: string) => {
    const y = value.top + value.height / 2;
    for (const fraction of [0.15, 0.5, 0.85]) {
      const x = value.left + value.width * fraction,
        hit = document.elementFromPoint(x, y);
      const ownHit = hit && (target === hit || target.contains(hit));
      const noninteractiveOwnAncestor =
        hit && getComputedStyle(target).pointerEvents === "none" && hit.contains(target);
      if (!ownHit && !noninteractiveOwnAncestor)
        failures.push(`${description} covered at ${Math.round(x)},${Math.round(y)} by ${hit?.tagName ?? "no element"}`);
    }
  };
  if (normalize(element.textContent ?? "") !== normalize(input.expectedText))
    failures.push("Complete expected text changed");
  if (!painted(element)) failures.push("Target text is not painted");
  if (element.closest('[aria-hidden="true"], [inert]'))
    failures.push("Target belongs to an inactive or hidden surface");
  const range = document.createRange();
  range.selectNodeContents(element);
  const textRects = [...range.getClientRects()].map(rect).filter(positive);
  if (!textRects.length) failures.push("Target has no rendered text-line rectangles");
  for (const line of textRects) {
    if (!contains(viewport, line)) failures.push(`Text line outside viewport: ${JSON.stringify(line)}`);
    if (!contains(clipToAncestors(element, line), line))
      failures.push(`Text line clipped by an ancestor: ${JSON.stringify(line)}`);
    hitFailure(element, line, "Text line");
  }

  if (input.kind === "receipt") {
    const drawers = [
      ...document.querySelectorAll<HTMLElement>('.journal-objects-drawer.open[aria-hidden="false"]:not([inert])'),
    ]
      .filter(painted)
      .filter((drawer) =>
        [...drawer.querySelectorAll("h2")].some(
          (heading) => normalize(heading.textContent ?? "") === "Charts and locations",
        ),
      );
    if (drawers.length !== 1) failures.push(`Expected one open Charts and locations drawer, found ${drawers.length}`);
    const obstacles = drawers.map((drawer) => ({
      name: "Charts and locations",
      rect: rect(drawer.getBoundingClientRect()),
    }));
    for (const line of textRects)
      for (const obstacle of obstacles)
        if (positive(intersect(line, obstacle.rect)))
          failures.push(`Receipt text intersects ${obstacle.name}: ${JSON.stringify(line)}`);
    return { failures, viewport, textRects, obstacles };
  }

  if (Math.abs(window.scrollY) > 1 || Math.abs(window.scrollX) > 1)
    failures.push("Journal is not at deliberate scroll zero");
  if (viewport.width >= viewport.height) failures.push("Phone first-viewport check requires portrait orientation");
  if (document.documentElement.scrollWidth > innerWidth + 1) failures.push("Journal overflows horizontally");
  const leaf = element.closest<HTMLElement>(".journal-leaf"),
    book = element.closest<HTMLElement>(".main-journal-book");
  if (!leaf || !book || !painted(leaf)) {
    failures.push("Expected heading is not on a painted active Journal leaf");
    return { failures, viewport, textRects, obstacles: [] };
  }
  const obstacles = [
    ...document.querySelectorAll<HTMLElement>(
      ".journal-context-tabs:not([inert]), .chronicle-objective-tray:not([inert]), .journal-context-drawer.open:not([inert])",
    ),
  ]
    .filter(painted)
    .map((target) => ({
      name: target.classList.contains("chronicle-objective-tray")
        ? "Current objective"
        : target.classList.contains("journal-context-tabs")
          ? "Journal tools"
          : "Open Journal drawer",
      rect: rect(target.getBoundingClientRect()),
    }));
  for (const line of textRects)
    for (const obstacle of obstacles)
      if (positive(intersect(line, obstacle.rect))) failures.push(`Active heading intersects ${obstacle.name}`);

  let candidates = [clipToAncestors(leaf, intersect(rect(leaf.getBoundingClientRect()), viewport))].filter(positive);
  for (const obstacle of obstacles) {
    const next: Rect[] = [];
    for (const candidate of candidates) {
      const overlap = intersect(candidate, obstacle.rect);
      if (!positive(overlap)) next.push(candidate);
      else
        next.push(
          box(candidate.left, candidate.top, candidate.right, overlap.top),
          box(candidate.left, overlap.bottom, candidate.right, candidate.bottom),
          box(candidate.left, candidate.top, overlap.left, candidate.bottom),
          box(overlap.right, candidate.top, candidate.right, candidate.bottom),
        );
    }
    candidates = next.filter(positive);
  }
  // A substantive reading band, not merely a sliver of paper or a heading below the fold.
  // At the existing390x844 phone viewport this requires211px of reading height and280px of width.
  const minimumReadingArea = {
    width: Math.min(280, viewport.width * 0.72),
    height: Math.min(240, Math.max(180, viewport.height * 0.25)),
  };
  const headingBounds = rect(range.getBoundingClientRect());
  const readingArea = candidates
    .filter((candidate) => contains(candidate, headingBounds) && candidate.width >= minimumReadingArea.width)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!readingArea || readingArea.height < minimumReadingArea.height)
    failures.push(
      `Insufficient unobscured first-viewport reading area: ${JSON.stringify({ readingArea, minimumReadingArea })}`,
    );
  if (readingArea)
    for (const fraction of [0.2, 0.5, 0.8]) {
      const band = box(
        readingArea.left,
        readingArea.top + readingArea.height * fraction - 1,
        readingArea.right,
        readingArea.top + readingArea.height * fraction + 1,
      );
      hitFailure(leaf, band, "Reading area");
    }
  return { failures, viewport, textRects, obstacles, readingArea, minimumReadingArea };
}

/** Checks the current receipt without scrolling, hiding the drawer, or changing the application state. */
export async function assertDesktopHandoffReceiptReadable(page: Page, handoff: Locator, exactSentence: string) {
  expect(exactSentence.trim().length, "Use the complete pending or acknowledgment sentence").toBeGreaterThan(20);
  await expect(
    page
      .getByRole("navigation", { name: "Journal tools", exact: true })
      .getByRole("button", { name: "map", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  const receipt = handoff.getByText(exactSentence, { exact: true });
  await expect(receipt).toHaveCount(1);
  let geometry: Geometry | undefined;
  await expect
    .poll(
      async () => {
        geometry = await receipt.evaluate(measureJournalGeometry, {
          kind: "receipt" as const,
          expectedText: exactSentence,
        });
        return geometry.failures;
      },
      { timeout: 10_000, message: "The complete handoff receipt stays readable beside the open Chart drawer" },
    )
    .toEqual([]);
  return geometry!;
}

/** Deliberately checks the initial portrait viewport; no scroll-into-view workaround is permitted. */
export async function assertPhoneJournalReadingArea(page: Page, activeHeading: string) {
  await expect(page.locator("main.chronicle-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  const heading = page.getByRole("heading", { name: activeHeading, exact: true });
  await expect(heading).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  let geometry: Geometry | undefined;
  await expect
    .poll(
      async () => {
        geometry = await heading.evaluate(measureJournalGeometry, {
          kind: "phone" as const,
          expectedText: activeHeading,
        });
        return geometry.failures;
      },
      {
        timeout: 10_000,
        message: "The active Journal heading and a usable reading band occupy the first phone viewport",
      },
    )
    .toEqual([]);
  return geometry!;
}

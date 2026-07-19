import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL,
  PAGE_TURN_LIFECYCLE_BROWSER_EVENT,
  type PageTurnLifecycleBrowserDetail,
} from "../../src/components/animation/PageFlipBook";
import { policyForProgressionEvent } from "../../src/components/player/progression/event-policy";
import type { ClientProgressEvent } from "../../src/domain/story";
import {
  capturePhase3DbTruth,
  expect,
  installPhase3EvidenceProbe,
  PHASE3_EVENT_CASES,
  phase3Test as test,
  readPhase3Evidence,
  readPreseededPhase3BaseFixture,
  readPreseededPhase3FixtureFromEnv,
  type Phase3CaseFixture,
  type Phase3DbTruth,
  type Phase3EventType,
  type Phase3PlayerSection,
} from "./fixtures/lanternwake-phase3";

const requiredViewports = [
  { label: "2560x1440", width: 2560, height: 1440 },
  { label: "1920x1080", width: 1920, height: 1080 },
  { label: "1440x900", width: 1440, height: 900 },
  { label: "430x932", width: 430, height: 932 },
  { label: "390x844", width: 390, height: 844 },
  { label: "844x390", width: 844, height: 390 },
] as const;

type AccessibilityFlow = Readonly<{
  id: string;
  section: Phase3PlayerSection;
  eventType: Phase3EventType | null;
  kind: "opening" | "reentry" | "event" | "replay" | "fallback" | "interruption";
}>;

const eventCase = (eventType: Phase3EventType) => {
  const found = PHASE3_EVENT_CASES.find((item) => item.eventType === eventType);
  if (!found) throw new Error(`Missing Phase 3 fixture case for ${eventType}.`);
  return found;
};

const sectionFor = (eventType: Phase3EventType): Phase3PlayerSection =>
  eventCase(eventType).relevantSection ?? "journal";

const p0P1Flows = [
  { id: "journal-first-opening", section: "journal", eventType: null, kind: "opening" },
  { id: "journal-reentry", section: "journal", eventType: null, kind: "reentry" },
  {
    id: "chapter-release",
    section: sectionFor("CHAPTER_RELEASED"),
    eventType: "CHAPTER_RELEASED",
    kind: "event",
  },
  {
    id: "map-location",
    section: sectionFor("MAP_LOCATION_REVEALED"),
    eventType: "MAP_LOCATION_REVEALED",
    kind: "event",
  },
  {
    id: "route-reveal",
    section: sectionFor("MAP_ROUTE_REVEALED"),
    eventType: "MAP_ROUTE_REVEALED",
    kind: "event",
  },
  {
    id: "artifact-award",
    section: sectionFor("ARTIFACT_AWARDED"),
    eventType: "ARTIFACT_AWARDED",
    kind: "event",
  },
  {
    id: "quest-discovery",
    section: sectionFor("SIDE_QUEST_DISCOVERED"),
    eventType: "SIDE_QUEST_DISCOVERED",
    kind: "event",
  },
  {
    id: "log-entry",
    section: sectionFor("PLAYER_LOG_ENTRY_ADDED"),
    eventType: "PLAYER_LOG_ENTRY_ADDED",
    kind: "event",
  },
  {
    id: "finale-tease",
    section: sectionFor("FINALE_TEASED"),
    eventType: "FINALE_TEASED",
    kind: "event",
  },
  { id: "pause", section: "journal", eventType: "CAMPAIGN_PAUSED", kind: "event" },
  { id: "replay", section: "journal", eventType: "CHAPTER_RELEASED", kind: "replay" },
  { id: "fallback", section: "journal", eventType: null, kind: "fallback" },
  { id: "interrupted-scene", section: "journal", eventType: "MAP_LOCATION_REVEALED", kind: "interruption" },
] as const satisfies readonly AccessibilityFlow[];

const viewportFlowCasesPerProject = requiredViewports.length * p0P1Flows.length;
if (
  requiredViewports.length !== 6 ||
  new Set(requiredViewports.map((viewport) => viewport.label)).size !== 6 ||
  new Set(requiredViewports.map((viewport) => `${viewport.width}x${viewport.height}`)).size !== 6 ||
  p0P1Flows.length !== 13 ||
  new Set(p0P1Flows.map((flow) => flow.id)).size !== 13 ||
  viewportFlowCasesPerProject !== 78
) {
  throw new Error("The Phase 3 accessibility matrix must remain exactly 13 unique flows by 6 unique viewports.");
}

type UnsafeRequest = Readonly<{ method: string; pathname: string }>;

type InterruptionOrderEntry = Readonly<{
  kind: "receipt" | "state";
  eventId: string | null;
  requestId: string | null;
  status: string;
}>;

const sectionLabels: Readonly<Record<Phase3PlayerSection, string>> = {
  journal: "Journal",
  chart: "Chart",
  treasures: "Altar",
  quests: "Ledger",
  log: "Log",
  finale: "Finale",
};

async function installReadOnlyNetwork(
  page: Page,
  slug: string,
  targetEventId: string | null,
  unsafeRequests: UnsafeRequest[],
) {
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/") && method !== "GET" && method !== "HEAD") {
      unsafeRequests.push({ method, pathname });
    }
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const pathname = new URL(request.url()).pathname;
    const locallyIntercepted =
      method === "POST" && (pathname === `/api/player/${slug}/presence` || pathname === `/api/player/${slug}/viewed`);
    if (method === "GET" || method === "HEAD" || locallyIntercepted) {
      await route.fallback();
      return;
    }
    await route.abort("blockedbyclient");
  });
  await page.route(`**/api/player/${slug}/events**`, (route) => route.abort("blockedbyclient"));
  await page.route(`**/api/player/${slug}/presence`, async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route(`**/api/player/${slug}/viewed**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      const requested = url.searchParams.getAll("eventIds");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ acknowledgedEventIds: requested.filter((id) => id !== targetEventId) }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function installPlayerCookie(page: Page, playerAccessId: string, baseURL: string) {
  await page.context().addCookies([
    {
      name: "forever_player",
      value: playerAccessId,
      url: baseURL,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

async function readExactPreseededEvent(page: Page, fixture: Phase3CaseFixture, baseURL: string) {
  await installPlayerCookie(page, fixture.playerAccessId, baseURL);
  const response = await page.request.get(`/api/player/${fixture.slug}/snapshot`);
  const body = await response.text();
  expect(response.status(), body).toBe(200);
  const snapshot = JSON.parse(body) as { presentationHistory?: ClientProgressEvent[] };
  const event = snapshot.presentationHistory?.find((candidate) => candidate.id === fixture.prerequisiteEventId);
  expect(event, `Read-only fixture ${fixture.caseId} must expose its exact presentation event.`).toBeTruthy();
  return Object.freeze({ ...event!, payload: Object.freeze({ ...event!.payload }) });
}

async function installPageFlipReadinessFailure(page: Page) {
  await page.addInitScript(
    ({ eventName, failpointGlobal }) => {
      const receipts: PageTurnLifecycleBrowserDetail[] = [];
      Object.defineProperty(window, "__phase3PageFlipFailureReceipts", { value: receipts, configurable: true });
      (window as unknown as Window & Record<string, string | undefined>)[failpointGlobal] = "readiness-probe";
      window.addEventListener(eventName, (event) => {
        receipts.push(structuredClone((event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail));
      });
    },
    {
      eventName: PAGE_TURN_LIFECYCLE_BROWSER_EVENT,
      failpointGlobal: PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL,
    },
  );
}

async function installReadOnlyAuthoritativeEventSeam(page: Page) {
  await page.addInitScript(() => {
    type SeamEvent = {
      id: string;
      type: string;
      sequence: number;
      payload: Record<string, unknown>;
      releaseAt: string;
    };
    type SeamSource = EventTarget & { readyState: number; close(): void };
    const sources = new Set<SeamSource>();
    const order: InterruptionOrderEntry[] = [];
    const seam = {
      connectionCount: 0,
      dispatchCount: 0,
      lastEventId: null as string | null,
      emit(event: SeamEvent) {
        this.dispatchCount += 1;
        this.lastEventId = event.id;
        for (const source of sources) {
          if (source.readyState !== 1) continue;
          source.dispatchEvent(new MessageEvent("progression", { data: JSON.stringify(event) }));
        }
      },
    };
    class ReadOnlyEventSource extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSED = 2;
      readonly url: string;
      readonly withCredentials = false;
      readyState = 0;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        sources.add(this);
        queueMicrotask(() => {
          if (this.readyState === this.CLOSED) return;
          this.readyState = this.OPEN;
          seam.connectionCount += 1;
          const event = new Event("open");
          this.dispatchEvent(event);
          this.onopen?.(event);
        });
      }

      close() {
        if (this.readyState === this.CLOSED) return;
        this.readyState = this.CLOSED;
        sources.delete(this);
      }
    }
    Object.defineProperty(window, "EventSource", { value: ReadOnlyEventSource, configurable: true });
    Object.defineProperty(window, "__phase3ReadOnlyAuthoritativeEventSeam", {
      value: seam,
      configurable: true,
    });
    Object.defineProperty(window, "__phase3InterruptionOrder", { value: order, configurable: true });
    window.addEventListener("forever:progression-receipt", (event) => {
      const detail = (event as CustomEvent<{ eventId: string; requestId: string; status: string }>).detail;
      order.push({ kind: "receipt", eventId: detail.eventId, requestId: detail.requestId, status: detail.status });
    });
    window.addEventListener("forever:progression-state", (event) => {
      const detail = (event as CustomEvent<{ eventId: string | null; requestId: string | null; transition: string }>)
        .detail;
      order.push({
        kind: "state",
        eventId: detail.eventId,
        requestId: detail.requestId,
        status: detail.transition,
      });
    });
  });
}

async function installLiveRegionProbe(page: Page) {
  await page.addInitScript(() => {
    const announcements: Array<{ politeness: string; text: string }> = [];
    const seen = new Set<string>();
    const inspect = () => {
      for (const node of document.querySelectorAll<HTMLElement>('[aria-live="polite"], [aria-live="assertive"]')) {
        const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!text) continue;
        const politeness = node.getAttribute("aria-live") ?? "off";
        const key = `${politeness}\u0000${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        announcements.push({ politeness, text });
      }
    };
    new MutationObserver(inspect).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-live", "hidden", "aria-hidden"],
    });
    Object.defineProperty(window, "__phase3Announcements", { value: announcements, configurable: true });
  });
}

async function openReadableJournal(page: Page, slug: string, returning: boolean) {
  if (returning) {
    await page.evaluate((currentSlug) => sessionStorage.setItem(`forever-intro:${currentSlug}`, "seen"), slug);
    await page.reload();
  }
  const open = page.getByRole("button", { name: "Open the journal" });
  await expect(open).toBeVisible();
  await open.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole("heading", { name: "The Voyage Journal" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-player-experience-root]")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
}

async function assertModalFocusAndRestoration(page: Page, eventType: Phase3EventType) {
  const overlay = page.locator(
    `[data-progression-overlay][data-progression-state="active"][data-presentation-event="${eventType}"]`,
  );
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  await expect(overlay).toHaveAttribute("aria-modal", "true");
  const requiredTargets = overlay.locator('[data-presentation-relevance="relevant"]');
  expect(await requiredTargets.count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      requiredTargets.evaluateAll(
        (targets) =>
          Boolean(targets.length) &&
          targets.every((target) => {
            const style = getComputedStyle(target);
            const bounds = target.getBoundingClientRect();
            return (
              style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && bounds.width > 0
            );
          }),
      ),
    )
    .toBe(true);
  const stacking = await overlay.evaluate((node) => {
    const content = document.querySelector<HTMLElement>("[data-progression-content]");
    return {
      overlay: Number.parseInt(getComputedStyle(node).zIndex || "0", 10),
      content: content ? Number.parseInt(getComputedStyle(content).zIndex || "0", 10) : 0,
    };
  });
  expect(stacking.overlay).toBeGreaterThan(stacking.content);
  const controls = overlay.getByRole("button").filter({ visible: true });
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  const first = controls.first();
  const last = controls.last();
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await first.click();
  await expect(overlay).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(
          active &&
            active !== document.body &&
            !(active instanceof HTMLElement && active.closest('[inert], [aria-hidden="true"], [data-pageflip-source]')),
        );
      }),
    )
    .toBe(true);
}

async function assertPageFlipReadinessFallback(page: Page) {
  const book = page.locator(".main-journal-book");
  await expect(book).toHaveAttribute("data-pageflip-status", "fallback");
  await expect(book).toHaveAttribute("data-pageflip-fallback-reason", "development-readiness-probe");
  await expect(book.locator("[data-pageflip-runtime], [data-pageflip-source]")).toHaveCount(0);
  const staticPage = book.locator(".reduced-page-stage > [data-page-index]");
  await expect(staticPage).toHaveCount(1);
  await expect(staticPage).toBeVisible();
  await expect(staticPage).not.toHaveAttribute("aria-hidden", "true");
  const receipts = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __phase3PageFlipFailureReceipts: PageTurnLifecycleBrowserDetail[];
        }
      ).__phase3PageFlipFailureReceipts,
  );
  expect(
    receipts.filter(
      (receipt) =>
        receipt.phase === "failed" &&
        receipt.reason === "development-readiness-probe" &&
        receipt.fallbackStatus === "fallback",
    ),
  ).toHaveLength(1);
}

async function startExactReplay(page: Page, eventId: string) {
  const notice = page.locator(`[data-progress-event-id="${eventId}"]`);
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole("button", { name: "Replay presentation" }).click();
    return;
  }
  const history = page.locator("[data-presentation-history] details");
  if (!(await history.getAttribute("open"))) await history.locator("summary").click();
  await history.locator(`[data-replay-event-id="${eventId}"]`).click();
}

async function assertAuthoritativeReplayInterruption(
  page: Page,
  replayEvent: ClientProgressEvent,
  replacementEvent: ClientProgressEvent,
) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Window & {
              __phase3ReadOnlyAuthoritativeEventSeam: { connectionCount: number };
            }
          ).__phase3ReadOnlyAuthoritativeEventSeam.connectionCount,
      ),
    )
    .toBe(1);
  await startExactReplay(page, replayEvent.id);
  const overlay = page.locator('[data-progression-overlay][data-progression-state="active"]');
  await expect(overlay).toHaveAttribute("data-presentation-id", new RegExp(replayEvent.id));
  await page.evaluate((event) => {
    (
      window as unknown as Window & {
        __phase3ReadOnlyAuthoritativeEventSeam: { emit(value: ClientProgressEvent): void };
      }
    ).__phase3ReadOnlyAuthoritativeEventSeam.emit(event);
  }, replacementEvent);
  await expect(overlay).toHaveAttribute("data-presentation-id", new RegExp(replacementEvent.id));
  await expect(overlay).toHaveAttribute("data-presentation-event", replacementEvent.type);
  await overlay.getByRole("button", { name: "Reveal readable result" }).click();
  await expect(overlay).toBeHidden();

  const evidence = await readPhase3Evidence(page);
  const interrupted = evidence.receipts.filter(
    (receipt) => receipt.eventId === replayEvent.id && receipt.source === "replay" && receipt.status === "interrupted",
  );
  const replacement = evidence.receipts.filter(
    (receipt) => receipt.eventId === replacementEvent.id && receipt.source === "live" && receipt.status === "skipped",
  );
  expect(interrupted).toHaveLength(1);
  expect(replacement).toHaveLength(1);
  expect(replacement[0]).toMatchObject({
    eventType: replacementEvent.type,
    eventSequence: replacementEvent.sequence,
    acknowledgmentEligible: true,
    acknowledgmentAttempted: true,
  });
  const order = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __phase3InterruptionOrder: InterruptionOrderEntry[];
        }
      ).__phase3InterruptionOrder,
  );
  const interruptedRequest = interrupted[0]!.requestId;
  const replacementRequest = replacement[0]!.requestId;
  const positions = {
    interruptedReceipt: order.findIndex(
      (entry) => entry.kind === "receipt" && entry.requestId === interruptedRequest && entry.status === "interrupted",
    ),
    interruptedSettled: order.findIndex(
      (entry) => entry.kind === "state" && entry.requestId === interruptedRequest && entry.status === "settled",
    ),
    replacementReceipt: order.findIndex(
      (entry) => entry.kind === "receipt" && entry.requestId === replacementRequest && entry.status === "skipped",
    ),
    replacementSettled: order.findIndex(
      (entry) => entry.kind === "state" && entry.requestId === replacementRequest && entry.status === "settled",
    ),
  };
  expect(positions.interruptedReceipt).toBeGreaterThanOrEqual(0);
  expect(positions.interruptedSettled).toBeGreaterThan(positions.interruptedReceipt);
  expect(positions.replacementReceipt).toBeGreaterThan(positions.interruptedSettled);
  expect(positions.replacementSettled).toBeGreaterThan(positions.replacementReceipt);
  const seam = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __phase3ReadOnlyAuthoritativeEventSeam: { dispatchCount: number; lastEventId: string | null };
        }
      ).__phase3ReadOnlyAuthoritativeEventSeam,
  );
  expect(seam).toMatchObject({ dispatchCount: 1, lastEventId: replacementEvent.id });
}

async function assertReadableAtTwoHundredPercentZoom(page: Page) {
  const supported = await page.evaluate(() => CSS.supports("zoom", "2"));
  if (!supported) {
    test.info().annotations.push({ type: "zoom-unsupported", description: "This engine does not expose CSS zoom." });
    return;
  }
  await page.evaluate(() => document.documentElement.style.setProperty("zoom", "2"));
  await expect(page.getByRole("heading", { name: "The Voyage Journal" })).toBeVisible();
  const readable = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    text: document.querySelector("[data-player-experience-root]")?.textContent?.trim().length ?? 0,
  }));
  expect(readable.text).toBeGreaterThan(0);
  expect(readable.scrollWidth).toBeLessThanOrEqual(readable.viewportWidth + 1);
  await page.evaluate(() => document.documentElement.style.removeProperty("zoom"));
}

async function assertViewportAndAccessibility(page: Page, section: Phase3PlayerSection) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

  const currentSection = page.locator(
    `.companion-navigation:visible button[aria-current="page"], .mobile-nav:visible button.active`,
  );
  await expect(currentSection).toHaveCount(1);
  await expect(currentSection).toContainText(sectionLabels[section]);

  const controlsInsideViewport = await page
    .locator("button:visible, select:visible, input:visible")
    .evaluateAll((nodes) =>
      nodes.every((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.left >= -1 && bounds.right <= window.innerWidth + 1;
      }),
    );
  expect(controlsInsideViewport).toBe(true);

  const unnamedControls = await page.locator("button:visible, select:visible, input:visible").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const label = node.getAttribute("aria-label") || node.textContent || node.getAttribute("title") || "";
        return !label.trim();
      }).length,
  );
  expect(unnamedControls).toBe(0);
  await expect(page.locator('[data-hover-only]:not([aria-hidden="true"])')).toHaveCount(0);

  await currentSection.focus();
  const focusEvidence = await currentSection.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      visible: node.matches(":focus-visible"),
      outline: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== "none",
    };
  });
  expect(focusEvidence.visible || focusEvidence.outline || focusEvidence.shadow).toBe(true);
  await currentSection.press("Enter");
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await currentSection.tap();
  else await currentSection.click();
  await expect(currentSection).toHaveAttribute("aria-current", /page|true/);

  const hiddenFocusable = await page
    .locator('[aria-hidden="true"] a, [aria-hidden="true"] button, [inert] a, [inert] button, [data-pageflip-source] *')
    .evaluateAll(
      (nodes) =>
        nodes.filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          return node.tabIndex >= 0 && !node.hasAttribute("disabled");
        }).length,
    );
  expect(hiddenFocusable).toBe(0);

  const pageFlip = page.locator(".main-journal-book");
  if (section === "journal") {
    await expect(pageFlip).toBeVisible();
    const pageFlipBounds = await pageFlip.boundingBox();
    expect(pageFlipBounds?.width ?? 0).toBeGreaterThan(0);
    expect(pageFlipBounds?.height ?? 0).toBeGreaterThan(0);
    expect((pageFlipBounds?.x ?? -1) + (pageFlipBounds?.width ?? 0)).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  } else {
    await expect(pageFlip).toHaveCount(0);
    await expect(page.locator("[data-pageflip-source]")).toHaveCount(0);
  }

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

function unsafeMutation(request: UnsafeRequest, slug: string) {
  return (
    request.method !== "POST" ||
    (request.pathname !== `/api/player/${slug}/presence` && request.pathname !== `/api/player/${slug}/viewed`)
  );
}

test.describe("Project Lanternwake Phase 3 accessibility and six required viewports", () => {
  let baseFixture: Phase3CaseFixture;
  let fixtures: Phase3CaseFixture[];
  let databaseBaseline: ReadonlyMap<string, Phase3DbTruth>;

  test.beforeAll(async () => {
    baseFixture = readPreseededPhase3BaseFixture();
    const byCampaign = new Map<string, Phase3CaseFixture>([[baseFixture.campaignId, baseFixture]]);
    for (const flow of p0P1Flows) {
      if (!flow.eventType) continue;
      const fixture = readPreseededPhase3FixtureFromEnv(flow.eventType);
      byCampaign.set(fixture.campaignId, fixture);
    }
    fixtures = [...byCampaign.values()];
    databaseBaseline = new Map(
      await Promise.all(
        fixtures.map(async (fixture) => [fixture.campaignId, await capturePhase3DbTruth(fixture)] as const),
      ),
    );
  });

  test.afterAll(async () => {
    for (const fixture of fixtures) {
      expect(
        await capturePhase3DbTruth(fixture),
        `Read-only viewport cases must not mutate fixture ${fixture.caseId}.`,
      ).toEqual(databaseBaseline.get(fixture.campaignId));
    }
  });

  for (const viewport of requiredViewports) {
    for (const flow of p0P1Flows) {
      test(`${viewport.label} ${flow.id} is readable, reachable, and sound-independent`, async ({
        page,
        browserName,
      }) => {
        test.setTimeout(90_000);
        const preseeded = flow.eventType ? readPreseededPhase3FixtureFromEnv(flow.eventType) : baseFixture;
        const playerAccessId = preseeded.playerAccessId;
        const slug = preseeded.slug;
        const path = preseeded.path;
        const targetEventId = flow.eventType ? preseeded.prerequisiteEventId : null;
        if (flow.eventType) {
          expect(targetEventId, `${flow.eventType} needs an exact manifest replay identity.`).toBeTruthy();
        }
        const baseURL = test.info().project.use.baseURL as string;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        if (flow.kind === "fallback") await installPageFlipReadinessFailure(page);
        let replayEvent: ClientProgressEvent | null = null;
        let replacementEvent: ClientProgressEvent | null = null;
        if (flow.kind === "interruption") {
          await installPhase3EvidenceProbe(page);
          await installReadOnlyAuthoritativeEventSeam(page);
          replayEvent = await readExactPreseededEvent(page, preseeded, baseURL);
          const replacementFixture = readPreseededPhase3FixtureFromEnv("PLAYER_LOG_ENTRY_ADDED");
          const replacementSource = await readExactPreseededEvent(page, replacementFixture, baseURL);
          replacementEvent = Object.freeze({ ...replacementSource, sequence: replayEvent.sequence + 1 });
        }
        await installPlayerCookie(page, playerAccessId, baseURL);
        const unsafeRequests: UnsafeRequest[] = [];
        await installReadOnlyNetwork(page, slug, targetEventId, unsafeRequests);
        await installLiveRegionProbe(page);
        await page.addInitScript(() => localStorage.setItem("forever-muted", "true"));

        await page.goto(`${path}?section=${flow.section}`);
        await openReadableJournal(page, slug, flow.kind === "reentry");

        if (flow.eventType && targetEventId) {
          await assertModalFocusAndRestoration(page, flow.eventType);
        }

        if (flow.kind === "replay") {
          const replay = page.getByRole("button", { name: /Replay (presentation|introduction)/ }).first();
          await expect(replay).toBeVisible();
          await replay.click();
          const skip = page.getByRole("button", { name: /Reveal readable result|Skip ceremony/ }).first();
          if (await skip.isVisible().catch(() => false)) await skip.click();
        }
        if (flow.kind === "fallback") await assertPageFlipReadinessFallback(page);
        if (flow.kind === "interruption") {
          expect(replayEvent).not.toBeNull();
          expect(replacementEvent).not.toBeNull();
          await assertAuthoritativeReplayInterruption(page, replayEvent!, replacementEvent!);
        }

        await assertViewportAndAccessibility(page, flow.section);
        if (flow.kind === "reentry") await assertReadableAtTwoHundredPercentZoom(page);
        await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
        const announcements = await page.evaluate(
          () =>
            (
              window as unknown as Window & {
                __phase3Announcements: Array<{ politeness: string; text: string }>;
              }
            ).__phase3Announcements,
        );
        const progressionAnnouncements = announcements.filter(({ text }) =>
          PHASE3_EVENT_CASES.some((item) =>
            text.includes(policyForProgressionEvent(item.eventType).globalPresentation.heading),
          ),
        );
        if (flow.eventType && targetEventId) {
          const policy = policyForProgressionEvent(flow.eventType);
          const matchingAnnouncements = progressionAnnouncements.filter(({ text }) =>
            text.includes(policy.globalPresentation.heading),
          );
          expect(matchingAnnouncements).toHaveLength(1);
          expect(matchingAnnouncements[0]?.politeness).toBe(policy.globalPresentation.announcement);
        }
        if (replacementEvent) {
          const replacementPolicy = policyForProgressionEvent(replacementEvent.type as Phase3EventType);
          const replacementAnnouncements = progressionAnnouncements.filter(({ text }) =>
            text.includes(replacementPolicy.globalPresentation.heading),
          );
          expect(replacementAnnouncements).toHaveLength(1);
          expect(replacementAnnouncements[0]?.politeness).toBe(replacementPolicy.globalPresentation.announcement);
        }

        expect(
          unsafeRequests.filter((request) => unsafeMutation(request, slug)),
          `${browserName} must remain mutation-free; presence calls are intercepted before the server.`,
        ).toEqual([]);
        const expectedViewedPosts = flow.kind === "interruption" ? 2 : flow.eventType ? 1 : 0;
        expect(unsafeRequests.filter((request) => request.pathname.endsWith("/viewed"))).toHaveLength(
          expectedViewedPosts,
        );
      });
    }
  }
});

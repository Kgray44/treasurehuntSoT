import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL,
  PAGE_TURN_LIFECYCLE_BROWSER_EVENT,
  type PageTurnLifecycleBrowserDetail,
} from "../../src/components/animation/PageFlipBook";
import type { ClientProgressEvent } from "../../src/domain/story";
import {
  capturePhase3DbTruth,
  expect,
  installCanonicalPhase3PlayerSession,
  PHASE3_EVENT_CASES,
  phase3Test as test,
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

async function readExactPreseededEvent(page: Page, fixture: Phase3CaseFixture, baseURL: string) {
  await installCanonicalPhase3PlayerSession(page, fixture, baseURL);
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
    Object.defineProperty(window, "__phase3Announcements", { value: announcements, configurable: true });
    // Scene-owned ARIA attributes can update at animation-frame frequency.
    // Sample live regions without observing that render stream directly.
    window.setInterval(inspect, 100);
    inspect();
  });
}

async function openReadableJournal(page: Page, slug: string, returning: boolean, eventType: Phase3EventType | null) {
  if (returning) {
    await page.evaluate((currentSlug) => sessionStorage.setItem(`forever-intro:${currentSlug}`, "seen"), slug);
    await page.reload();
  }
  const open = page.getByRole("button", { name: "Open the journal" });
  const shell = page.locator(".chronicle-journal-shell");
  await expect
    .poll(async () => {
      if ((await shell.getAttribute("data-journal-phase")) === "JOURNAL_READY") return "ready";
      return (await open.isVisible().catch(() => false)) ? "openable" : "pending";
    })
    .not.toBe("pending");
  if ((await shell.getAttribute("data-journal-phase")) === "JOURNAL_READY") return;
  await expect(open).toBeVisible();
  await open.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  // The control remains intentionally animated while the ceremony is active;
  // force is appropriate once its visibility has established user reachability.
  if (await skip.isVisible().catch(() => false)) await skip.click({ force: true });
  await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  // The canonical Journal renders the authorized event as its readable current
  // Passage. The retired compatibility overlay is not part of this surface;
  // keep the event-specific assertion on the Player-visible projection.
  if (eventType) await expect(shell).toContainText(`P3-READONLY-${eventType}`);
  await expect(shell.getByRole("heading", { level: 2 })).toBeVisible({
    timeout: 20_000,
  });
}

async function assertPageFlipReadinessFallback(page: Page) {
  const book = page.locator(".main-journal-book");
  await expect(book).toHaveAttribute("data-pageflip-status", "fallback");
  await expect(book).toHaveAttribute("data-pageflip-fallback-reason", "development-failpoint:readiness-probe");
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

async function assertCanonicalJournalAuthoritativeRefresh(page: Page, replacementEvent: ClientProgressEvent) {
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
  await page.evaluate((event) => {
    (
      window as unknown as Window & {
        __phase3ReadOnlyAuthoritativeEventSeam: { emit(value: ClientProgressEvent): void };
      }
    ).__phase3ReadOnlyAuthoritativeEventSeam.emit(event);
  }, replacementEvent);
  const journal = page.locator(".chronicle-journal-shell");
  await expect(journal).toHaveAttribute("data-live-event", "revealed");
  await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  await expect(page.locator("[data-progression-overlay]")).toHaveCount(0);
  const seam = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __phase3ReadOnlyAuthoritativeEventSeam: { dispatchCount: number; lastEventId: string | null };
        }
      ).__phase3ReadOnlyAuthoritativeEventSeam,
  );
  expect(seam).toMatchObject({ connectionCount: 1, dispatchCount: 1, lastEventId: replacementEvent.id });
}

async function assertReadableAtTwoHundredPercentZoom(page: Page) {
  const supported = await page.evaluate(() => CSS.supports("zoom", "2"));
  if (!supported) {
    test.info().annotations.push({ type: "zoom-unsupported", description: "This engine does not expose CSS zoom." });
    return;
  }
  await page.evaluate(() => document.documentElement.style.setProperty("zoom", "2"));
  await expect(page.locator(".chronicle-journal-shell").getByRole("heading", { level: 2 })).toBeVisible();
  const readable = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    text: document.querySelector(".chronicle-journal-shell")?.textContent?.trim().length ?? 0,
  }));
  expect(readable.text).toBeGreaterThan(0);
  expect(readable.scrollWidth).toBeLessThanOrEqual(readable.viewportWidth + 1);
  await page.evaluate(() => document.documentElement.style.removeProperty("zoom"));
}

async function assertViewportAndAccessibility(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

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

  await page.keyboard.press("Tab");
  const keyboardFocus = page.locator(":focus");
  await expect(keyboardFocus).toBeVisible();
  const focusEvidence = await keyboardFocus.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      visible: node.matches(":focus-visible"),
      outline: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== "none",
    };
  });
  expect(focusEvidence.visible || focusEvidence.outline || focusEvidence.shadow).toBe(true);

  const hiddenFocusable = await page
    .locator('[aria-hidden="true"] a, [aria-hidden="true"] button, [inert] a, [inert] button, [data-pageflip-source] *')
    .evaluateAll(
      (nodes) =>
        nodes.filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (node.closest('[aria-hidden="true"], [inert]')) return false;
          return node.tabIndex >= 0 && !node.hasAttribute("disabled");
        }).length,
    );
  expect(hiddenFocusable).toBe(0);

  const pageFlip = page.locator(".main-journal-book");
  await expect(pageFlip).toBeVisible();
  const pageFlipBounds = await pageFlip.boundingBox();
  expect(pageFlipBounds?.width ?? 0).toBeGreaterThan(0);
  expect(pageFlipBounds?.height ?? 0).toBeGreaterThan(0);
  expect((pageFlipBounds?.x ?? -1) + (pageFlipBounds?.width ?? 0)).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

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
        // Full-motion WebKit must complete the post-presentation Axe audit;
        // 90 seconds can expire after every user-visible check has passed.
        test.setTimeout(180_000);
        const preseeded = flow.eventType ? readPreseededPhase3FixtureFromEnv(flow.eventType) : baseFixture;
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
        let replacementEvent: ClientProgressEvent | null = null;
        if (flow.kind === "interruption") {
          await installReadOnlyAuthoritativeEventSeam(page);
          const canonicalEvent = await readExactPreseededEvent(page, preseeded, baseURL);
          expect(canonicalEvent.id).toBe(preseeded.prerequisiteEventId);
          const replacementFixture = readPreseededPhase3FixtureFromEnv("PLAYER_LOG_ENTRY_ADDED");
          const replacementSource = await readExactPreseededEvent(page, replacementFixture, baseURL);
          replacementEvent = Object.freeze({ ...replacementSource, sequence: canonicalEvent.sequence + 1 });
        }
        await installCanonicalPhase3PlayerSession(page, preseeded, baseURL);
        const unsafeRequests: UnsafeRequest[] = [];
        await installReadOnlyNetwork(page, slug, targetEventId, unsafeRequests);
        await installLiveRegionProbe(page);
        await page.addInitScript(() => localStorage.setItem("forever-muted", "true"));

        // Next dev can keep a document response open while it streams diagnostics.
        // Warm the authenticated canonical route before the visible navigation.
        // Its first dev-server compilation can otherwise refresh the page during
        // a real Player action; the warmup is read-only and shares this browser's
        // account-rooted cookie jar.
        const warmup = await page.request.get(`${path}?section=${flow.section}`);
        expect(warmup.ok(), `Canonical Journal route warmup returned ${warmup.status()}.`).toBe(true);
        // The assertion below owns readiness through the player-visible control,
        // rather than treating transport lifecycle as a product contract.
        await page.goto(`${path}?section=${flow.section}`, { waitUntil: "commit", timeout: 15_000 });
        await openReadableJournal(page, slug, flow.kind === "reentry", flow.eventType);

        if (flow.kind === "replay") {
          const replay = page.getByRole("button", { name: "Replay full opening" });
          await expect(replay).toBeVisible();
          await replay.click();
          // In WebKit the full-opening completion can replace the transient
          // skip control between the visibility probe and its actionability
          // check. Treat that replacement as a completed presentation, then
          // require the same semantic Journal-ready destination below.
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const skip = page.getByRole("button", { name: /Reveal readable result|Skip ceremony/ }).first();
            if (!(await skip.isVisible().catch(() => false))) break;
            try {
              await skip.click({ force: true, timeout: 2_500 });
              break;
            } catch {
              // The opening may have completed while this click was being
              // dispatched. Re-query once before relying on Journal-ready.
            }
          }
          await expect(page.locator(".chronicle-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
        }
        if (flow.kind === "fallback") await assertPageFlipReadinessFallback(page);
        if (flow.kind === "interruption") {
          expect(replacementEvent).not.toBeNull();
          await assertCanonicalJournalAuthoritativeRefresh(page, replacementEvent!);
        }

        await assertViewportAndAccessibility(page);
        if (flow.kind === "reentry") await assertReadableAtTwoHundredPercentZoom(page);
        await expect(page.getByRole("button", { name: /^Motion:/ })).toBeVisible();
        if (flow.eventType && targetEventId) {
          await expect(page.locator(".chronicle-journal-shell")).toContainText(`P3-READONLY-${flow.eventType}`);
        }
        if (replacementEvent) {
          expect(replacementEvent.type).toBe("PLAYER_LOG_ENTRY_ADDED");
          await expect(page.locator(".chronicle-journal-shell")).toContainText("P3-READONLY-MAP_LOCATION_REVEALED");
        }

        expect(
          unsafeRequests.filter((request) => unsafeMutation(request, slug)),
          `${browserName} must remain mutation-free; presence calls are intercepted before the server.`,
        ).toEqual([]);
        const viewedPostCount = unsafeRequests.filter((request) => request.pathname.endsWith("/viewed")).length;
        // Canonical Journal readiness is local/read-only. It does not invoke
        // the retired Companion acknowledgement endpoint for an already
        // authorized projection.
        expect(viewedPostCount).toBe(0);
      });
    }
  }
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  installCanonicalPhase3PlayerSession,
  installPhase3EvidenceProbe,
  readPreseededPhase3BaseFixture,
  readPreseededPhase3FixtureFromEnv,
  type Phase3CaseFixture,
  type Phase3PlayerSection,
} from "./fixtures/lanternwake-phase3";
import { gotoStable } from "./navigation";

const requiredViewports = [
  { width: 2560, height: 1440, label: "2560x1440" },
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 1440, height: 900, label: "1440x900" },
  { width: 430, height: 932, label: "430x932" },
  { width: 390, height: 844, label: "390x844" },
  { width: 844, height: 390, label: "844x390" },
] as const;

const showcaseBook = (page: Page) =>
  page.locator(
    'section.page-flip-book.showcase-book[data-pageflip-book-id="animation-showcase-pageflip"][data-pageflip-mount-id]',
  );

const metricValue = (page: Page, term: string) =>
  page
    .getByRole("complementary", { name: "Development performance metrics" })
    .locator("dt", { hasText: term })
    .locator("..")
    .locator("dd");

async function requireValidationIsolation(page: Page) {
  const response = await page.request.get("/api/dev/validation/database-identity");
  const body = (await response.json().catch(() => null)) as unknown;
  expect(response.status(), `Unsafe browser mutation refused: ${JSON.stringify(body)}`).toBe(200);
  expect(body).toEqual({ validationDatabase: true, nonceMatch: true });
}

async function openShowcase(page: Page, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/dev/animations");
  await expect(page.getByRole("heading", { name: "Forever Treasure Animation Showcase" })).toBeVisible();
}

async function waitForPageFlipRead(book: Locator) {
  await expect(book).toHaveCount(1);
  await expect(book).toHaveAttribute("data-flip-state", "read");
}

async function waitForStPageFlip(page: Page) {
  const book = showcaseBook(page);
  await expect(book.locator('[data-pageflip-runtime-claim="granted"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(book.locator('[data-pageflip-turn-owner="st-page-flip"]')).toHaveCount(1);
  await waitForPageFlipRead(book);
  await expect
    .poll(() =>
      book
        .locator('[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]')
        .count(),
    )
    .toBe(1);
  await expect(metricValue(page, "PageFlip instances")).toHaveText("1");
  return book;
}

async function expectStPageFlipOwnsTurn(book: Locator) {
  await waitForPageFlipRead(book);
  await expect(book.locator('[data-pageflip-runtime-claim="granted"]')).toHaveCount(1);
  await expect(book.locator('[data-pageflip-turn-owner="st-page-flip"]')).toHaveCount(1);
}

async function expectActionSpecificTurnLanding(book: Locator, action: "keyboard-next" | "programmatic-riddle") {
  await expectStPageFlipOwnsTurn(book);
  await expect
    .poll(
      () =>
        book.evaluate((element, requestedAction) => {
          const orientations = (["portrait", "landscape"] as const).filter((candidate) =>
            element.classList.contains(`orientation-${candidate}`),
          );
          const orientation = orientations.length === 1 ? orientations[0] : null;
          const expectedPage = orientation
            ? requestedAction === "keyboard-next"
              ? orientation === "portrait"
                ? 3
                : 4
              : orientation === "portrait"
                ? 3
                : 2
            : null;
          const primaryPages = Array.from(
            element.querySelectorAll<HTMLElement>(
              '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
            ),
          );
          const primary = primaryPages.length === 1 ? primaryPages[0] : null;
          const counterVisible =
            expectedPage !== null &&
            Array.from(element.querySelectorAll<HTMLElement>("span")).some(
              (candidate) =>
                candidate.textContent?.trim() === `Page ${expectedPage} of 4` && candidate.getClientRects().length > 0,
            );
          const visibleRiddles = Array.from(
            element.querySelectorAll<HTMLElement>(
              '.page-flip-host article[aria-label="Demonstration riddle page"]' +
                '[data-pageflip-role="primary"][data-pageflip-lifecycle="visible"]',
            ),
          ).filter((candidate) => candidate.getClientRects().length > 0);
          const riddleVisible = visibleRiddles.length === 1;
          const settled = Boolean(
            orientation &&
              expectedPage !== null &&
              primary &&
              primary.dataset.pageflipOrientation === orientation &&
              primary.dataset.pageflipPageIndex === String(expectedPage - 1) &&
              counterVisible &&
              (requestedAction !== "programmatic-riddle" || riddleVisible),
          );

          return JSON.stringify({
            settled,
            orientation,
            expectedPage,
            primaryCount: primaryPages.length,
            primaryOrientation: primary?.dataset.pageflipOrientation ?? null,
            primaryIndex: primary?.dataset.pageflipPageIndex ?? null,
            counterVisible,
            riddleVisible,
            visibleRiddleCount: visibleRiddles.length,
          });
        }, action),
      { message: `The ${action} landing must settle atomically across responsive orientation changes.` },
    )
    .toContain('"settled":true');
}

async function pageFlipDomCounts(page: Page) {
  return page.evaluate(() => ({
    hosts: document.querySelectorAll("[data-scene-host-id]").length,
    targets: document.querySelectorAll("[data-scene-target-id]").length,
    runtimeClaims: document.querySelectorAll('[data-pageflip-runtime-claim="granted"]').length,
    runtimeRoots: document.querySelectorAll("[data-pageflip-runtime]").length,
    sourceRoots: document.querySelectorAll(".page-flip-source[data-pageflip-source]").length,
    currentPrimary: document.querySelectorAll(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    ).length,
    retainedBoundaries: document.querySelectorAll("[data-pageflip-role]").length,
  }));
}

async function expectDisqualifiedPageFlipCopiesHidden(page: Page) {
  const result = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-pageflip-role="temporary"], [data-pageflip-role="unproven"], [data-pageflip-lifecycle="stale"]',
      ),
    );
    return {
      count: nodes.length,
      allHidden: nodes.every(
        (node) =>
          node.getAttribute("aria-hidden") === "true" &&
          node.hasAttribute("inert") &&
          node.dataset.pageflipCurrent === "false",
      ),
      authorityMarkers: nodes.filter((node) =>
        node.matches("[data-scene-target-id], [data-scene-instance-id], [data-animation-claim-id]"),
      ).length,
    };
  });
  expect(result.allHidden, `${result.count} stale or temporary PageFlip copies must remain inaccessible.`).toBe(true);
  expect(result.authorityMarkers).toBe(0);
}

async function idIntegrity(page: Page) {
  return page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const element of document.querySelectorAll<HTMLElement>("[id]")) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }

    const unresolved: string[] = [];
    const single = ["for", "list", "form", "aria-activedescendant"];
    const multiple = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "headers"];
    const urlReferences = [
      "href",
      "xlink:href",
      "clip-path",
      "fill",
      "filter",
      "mask",
      "marker-start",
      "marker-mid",
      "marker-end",
    ];
    const verify = (element: Element, attribute: string, token: string) => {
      const id = token.startsWith("#") ? token.slice(1) : token;
      if (id && !counts.has(id)) unresolved.push(`${element.tagName.toLowerCase()}[${attribute}=${token}]`);
    };

    for (const element of document.querySelectorAll("*")) {
      for (const attribute of single) {
        const value = element.getAttribute(attribute)?.trim();
        if (value) verify(element, attribute, value);
      }
      for (const attribute of multiple) {
        for (const value of element.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? []) {
          verify(element, attribute, value);
        }
      }
      for (const attribute of urlReferences) {
        const value = element.getAttribute(attribute)?.trim();
        if (!value) continue;
        const direct = value.startsWith("#") ? value : null;
        const match = value.match(/^url\(["']?#([^"')]+)["']?\)$/);
        if (direct) verify(element, attribute, direct);
        else if (match?.[1]) verify(element, attribute, match[1]);
      }
    }

    return {
      duplicateIds: [...counts.entries()].filter(([, count]) => count > 1),
      unresolved,
    };
  });
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function enterCaptainWorkspace(page: Page) {
  expect(process.env.GM_USERNAME, "GM_USERNAME is required for the isolated Captain fixture.").toBeTruthy();
  expect(process.env.GM_PASSWORD, "GM_PASSWORD is required for the isolated Captain fixture.").toBeTruthy();
  await page.goto("/captain/sign-in");
  await expect(page.getByRole("heading", { name: "Open the Captain's Console" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to account sign-in" })).toBeVisible();
  const login = await page.request.post("/api/gm/login", {
    data: { username: process.env.GM_USERNAME, password: process.env.GM_PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);
  await gotoStable(page, "/captain/library");
  await expect(page).toHaveURL(/\/captain\/library(?:\?.*)?$/u);
  await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible({ timeout: 20_000 });
}

type PageFlipBoundaryEvidence = Readonly<{
  instanceId: string | null;
  runtimeGeneration: string | null;
  sourceGeneration: string | null;
  contentRevision: string | null;
  cloneGeneration: string | null;
  orientation: string | null;
  currentPageId: string | null;
  retainedBoundaries: number;
}>;

async function pageFlipBoundaryEvidence(book: Locator): Promise<PageFlipBoundaryEvidence> {
  return book.evaluate((element) => {
    const runtime = element.querySelector<HTMLElement>("[data-pageflip-runtime]");
    const source = element.querySelector<HTMLElement>("[data-pageflip-source]");
    const sourcePage = source?.querySelector<HTMLElement>("[data-pageflip-content-revision]");
    const current = element.querySelector<HTMLElement>(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    );
    return {
      instanceId: runtime?.dataset.pageflipInstanceId ?? source?.dataset.pageflipInstanceId ?? null,
      runtimeGeneration: runtime?.dataset.pageflipRuntimeGeneration ?? null,
      sourceGeneration: source?.dataset.pageflipSourceGeneration ?? null,
      contentRevision: sourcePage?.dataset.pageflipContentRevision ?? null,
      cloneGeneration: current?.dataset.pageflipCloneGeneration ?? null,
      orientation: current?.dataset.pageflipOrientation ?? null,
      currentPageId: current?.dataset.pageflipPageId ?? null,
      retainedBoundaries: element.querySelectorAll("[data-pageflip-role]").length,
    };
  });
}

async function expectOldPageFlipGenerationReleased(
  book: Locator,
  evidence: Pick<PageFlipBoundaryEvidence, "cloneGeneration" | "sourceGeneration">,
) {
  if (evidence.cloneGeneration !== null) {
    await expect(book.locator(`[data-pageflip-clone-generation="${evidence.cloneGeneration}"]`)).toHaveCount(0);
  }
  if (evidence.sourceGeneration !== null) {
    await expect(book.locator(`[data-pageflip-source-generation="${evidence.sourceGeneration}"]`)).toHaveCount(0);
  }
  await expectDisqualifiedPageFlipCopiesHidden(book.page());
}

async function openDefaultPlayerJournal(page: Page, { skipOpening = true }: { skipOpening?: boolean } = {}) {
  expect(
    process.env.PLAYER_ACCESS_CODE,
    "PLAYER_ACCESS_CODE is required for the isolated Player fixture.",
  ).toBeTruthy();
  await page.goto("/tale/development-forever-treasure");
  await page.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  await page.getByRole("button", { name: "Confirm invitation" }).click();
  const open = page.getByRole("button", { name: "Open the journal" });
  await openPlayerJournalEntry(page, open);

  if (skipOpening) {
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) await skip.click();
  }
  await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
}

async function readQuartermasterStatus(page: Page) {
  const response = await page.request.get("/api/gm/status");
  const body = (await response.json()) as {
    csrfToken: string;
    campaign: { slug: string; status: string; sequence: number };
  };
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body;
}

async function publishDefaultProgression(page: Page) {
  const status = await readQuartermasterStatus(page);
  const command = status.campaign.status === "PAUSED" ? "RESUME" : "ADD_LOG_ENTRY";
  const response = await page.request.post("/api/gm/commands", {
    headers: { "x-csrf-token": status.csrfToken },
    data: {
      command,
      campaignSlug: status.campaign.slug,
      expectedSequence: status.campaign.sequence,
      idempotencyKey: crypto.randomUUID(),
      payload: {},
      confirmation: true,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    persistence?: string;
    event?: { id: string; sequence: number };
    error?: string;
  } | null;
  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body).toMatchObject({ persistence: "COMMITTED", event: { sequence: status.campaign.sequence + 1 } });
  return body!.event!;
}

async function installReadOnlyPlayerNetwork(page: Page, fixture: Phase3CaseFixture) {
  const eventId = fixture.prerequisiteEventId;
  await page.route(`**/api/player/${fixture.slug}/events**`, (route) => route.abort("blockedbyclient"));
  await page.route(`**/api/player/${fixture.slug}/presence`, (route) => route.fulfill({ status: 204, body: "" }));
  await page.route(`**/api/player/${fixture.slug}/viewed**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      const requested = new URL(request.url()).searchParams.getAll("eventIds");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ acknowledgedEventIds: requested }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  expect(eventId === null || typeof eventId === "string").toBe(true);
}

async function openReadOnlyPhase3Player(
  page: Page,
  fixture: Phase3CaseFixture,
  section: Phase3PlayerSection,
  { skipOpening = true }: { skipOpening?: boolean } = {},
) {
  await installReadOnlyPlayerNetwork(page, fixture);
  await page.addInitScript(({ deviceId }) => {
    localStorage.setItem("forever-device", deviceId);
    localStorage.setItem("forever-motion", "full");
    localStorage.setItem("forever-muted", "true");
  }, fixture);
  await installCanonicalPhase3PlayerSession(
    page,
    fixture,
    String(test.info().project.use.baseURL ?? "http://127.0.0.1:3100"),
  );
  await page.goto(`${fixture.path}?section=${section}&journalSpeed=0.25`);
  const open = page.getByRole("button", { name: "Open the journal" });
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  if (skipOpening) {
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) await skip.click();
  }
  await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
  await expect(page.getByRole("region", { name: /Voyage Journal$/u })).toBeVisible();
  await expect(page.locator(".chronicle-journal-shell .main-journal-book")).toHaveCount(1);
}

test.describe("Project Lanternwake Phase 2 StPageFlip boundary", () => {
  test("full motion keeps source, clone identity, accessibility, and all turn paths inside StPageFlip authority", async ({
    page,
  }) => {
    await openShowcase(page);
    const book = await waitForStPageFlip(page);
    const source = book.locator(".page-flip-source[data-pageflip-source]");

    await expect(source).toHaveCount(1);
    await expect(source).toHaveAttribute("aria-hidden", "true");
    await expect(source).toHaveAttribute("inert", "");
    await expect(
      source.locator("[data-scene-target-id], [data-scene-instance-id], [data-animation-claim-id]"),
    ).toHaveCount(0);
    await expect(book.locator(".page-flip-runtime [data-pageflip-source]")).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Demonstration journal cover" })).toHaveCount(1);
    await expectDisqualifiedPageFlipCopiesHidden(page);

    const integrity = await idIntegrity(page);
    expect(integrity.duplicateIds).toEqual([]);
    expect(integrity.unresolved).toEqual([]);

    await page.getByRole("button", { name: "Next journal page" }).click();
    await expect(page.getByText("Page 2 of 4")).toBeVisible();
    await expectStPageFlipOwnsTurn(book);

    await page.getByRole("button", { name: "Next journal page" }).focus();
    await page.keyboard.press("ArrowRight");
    await expectActionSpecificTurnLanding(book, "keyboard-next");

    await page.getByRole("button", { name: "Previous journal page" }).click();
    await expect(page.getByText("Page 2 of 4")).toBeVisible();
    await expectStPageFlipOwnsTurn(book);
    await page.getByLabel("Scene").selectOption("programmatic-flip");
    await page.getByRole("button", { name: "Play selected scene" }).click();
    await expectActionSpecificTurnLanding(book, "programmatic-riddle");
    await expectDisqualifiedPageFlipCopiesHidden(page);
  });

  test("twenty showcase remount cycles return public host, target, claim, runtime, and retained-node counts to baseline", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "The bounded 20-cycle runtime stress case runs once in Chromium.");
    test.setTimeout(180_000);
    await openShowcase(page);
    const book = await waitForStPageFlip(page);
    const baseline = await pageFlipDomCounts(page);
    expect(baseline.runtimeClaims).toBe(1);
    expect(baseline.runtimeRoots).toBe(1);
    expect(baseline.sourceRoots).toBe(1);
    expect(baseline.currentPrimary).toBe(1);
    let previousMount = await book.getAttribute("data-pageflip-mount-id");

    for (let cycle = 1; cycle <= 20; cycle += 1) {
      await page.getByRole("button", { name: "Reset" }).click();
      await expect
        .poll(() => book.getAttribute("data-pageflip-mount-id"), {
          message: `Cycle ${cycle} must replace the prior PageFlip mount identity.`,
        })
        .not.toBe(previousMount);
      await waitForStPageFlip(page);
      await expect
        .poll(() => pageFlipDomCounts(page), {
          message: `Cycle ${cycle} must return public authority and retained-node counts to baseline.`,
        })
        .toEqual(baseline);
      await expectDisqualifiedPageFlipCopiesHidden(page);
      previousMount = await book.getAttribute("data-pageflip-mount-id");
    }
  });

  test("reduced motion renders one readable static page and no StPageFlip runtime", async ({ page }) => {
    await openShowcase(page, "reduce");
    const book = showcaseBook(page);
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    await expect(book).toHaveAttribute("data-pageflip-status", "reduced");
    await expect(book.locator("[data-pageflip-runtime], [data-pageflip-source]")).toHaveCount(0);
    await expect(book.getByRole("article", { name: "Demonstration journal cover" })).toBeVisible();
    await expect(book.getByRole("button", { name: "Previous journal page" })).toBeDisabled();
    await book.getByRole("button", { name: "Next journal page" }).click();
    await expect(book.getByText("Page 2 of 4")).toBeVisible();
    await expect(book.getByRole("article", { name: "Demonstration title page" })).toContainText(
      "A Safe Moonlit Bearing",
    );
  });

  test("content revision and orientation changes revoke the old generation and expose zero retained references", async ({
    page,
    browser,
    browserName,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1_440, height: 900 });

    if (browserName === "chromium") {
      await requireValidationIsolation(page);
      expect(baseURL, "Playwright must provide its isolated base URL.").toBeTruthy();
      const captainContext = await browser.newContext({ baseURL });
      try {
        const captainPage = await captainContext.newPage();
        await enterCaptainWorkspace(captainPage);
        await page.addInitScript(() => localStorage.setItem("forever-motion", "full"));
        await openDefaultPlayerJournal(page, { skipOpening: false });
        const book = page.locator(".main-journal-book");
        await expectStPageFlipOwnsTurn(book);
        const beforeRevision = await pageFlipBoundaryEvidence(book);
        expect(beforeRevision.contentRevision).toMatch(/\S/u);
        expect(beforeRevision.cloneGeneration).toMatch(/^\d+$/u);
        expect(beforeRevision.sourceGeneration).toMatch(/^\d+$/u);

        await publishDefaultProgression(captainPage);
        await expect
          .poll(() => pageFlipBoundaryEvidence(book), {
            message: "A committed snapshot sequence must replace the PageFlip content generation.",
            timeout: 20_000,
          })
          .toMatchObject({
            instanceId: beforeRevision.instanceId,
            runtimeGeneration: beforeRevision.runtimeGeneration,
            orientation: beforeRevision.orientation,
          });
        await expect
          .poll(async () => (await pageFlipBoundaryEvidence(book)).contentRevision)
          .not.toBe(beforeRevision.contentRevision);
        await expect
          .poll(async () => (await pageFlipBoundaryEvidence(book)).cloneGeneration)
          .not.toBe(beforeRevision.cloneGeneration);
        await expect
          .poll(async () => (await pageFlipBoundaryEvidence(book)).sourceGeneration)
          .not.toBe(beforeRevision.sourceGeneration);
        await expectOldPageFlipGenerationReleased(book, beforeRevision);

        const reveal = page.getByRole("button", { name: "Reveal readable result" });
        if (await reveal.isVisible().catch(() => false)) await reveal.click();
        await expect(page.locator('[data-progression-overlay][data-progression-state="active"]')).toHaveCount(0);

        const beforeOrientation = await pageFlipBoundaryEvidence(book);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect
          .poll(async () => (await pageFlipBoundaryEvidence(book)).orientation, {
            message: "The narrow journal must rebind its trusted primary pages as portrait pages.",
          })
          .toBe("portrait");
        await expect
          .poll(async () => (await pageFlipBoundaryEvidence(book)).cloneGeneration)
          .not.toBe(beforeOrientation.cloneGeneration);
        const afterOrientation = await pageFlipBoundaryEvidence(book);
        expect(afterOrientation).toMatchObject({
          instanceId: beforeOrientation.instanceId,
          runtimeGeneration: beforeOrientation.runtimeGeneration,
          sourceGeneration: beforeOrientation.sourceGeneration,
          contentRevision: beforeOrientation.contentRevision,
        });
        expect(afterOrientation.retainedBoundaries).toBe(beforeOrientation.retainedBoundaries);
        await expectOldPageFlipGenerationReleased(book, {
          cloneGeneration: beforeOrientation.cloneGeneration,
          sourceGeneration: null,
        });
      } finally {
        await captainContext.close();
      }
      return;
    }

    const fixture = readPreseededPhase3BaseFixture();
    await installPhase3EvidenceProbe(page);
    await openReadOnlyPhase3Player(page, fixture, "journal", { skipOpening: false });
    const book = page.locator(".main-journal-book");
    await expectStPageFlipOwnsTurn(book);
    const landscape = await pageFlipBoundaryEvidence(book);
    expect(landscape.orientation).toBe("landscape");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await pageFlipBoundaryEvidence(book)).orientation).toBe("portrait");
    await expect
      .poll(async () => (await pageFlipBoundaryEvidence(book)).cloneGeneration)
      .not.toBe(landscape.cloneGeneration);
    const portrait = await pageFlipBoundaryEvidence(book);
    expect(portrait.contentRevision).toBe(landscape.contentRevision);
    expect(portrait.retainedBoundaries).toBe(landscape.retainedBoundaries);
    await expectOldPageFlipGenerationReleased(book, {
      cloneGeneration: landscape.cloneGeneration,
      sourceGeneration: null,
    });
  });

  test("only the current visible Passage remains interactive in the canonical Journal PageFlip boundary", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = readPreseededPhase3FixtureFromEnv("SIDE_QUEST_DISCOVERED");
    await openReadOnlyPhase3Player(page, fixture, "journal", { skipOpening: false });
    const book = page.locator('.main-journal-book[data-pageflip-book-id="physical-journal"]');
    await expectStPageFlipOwnsTurn(book);

    const current = book.locator(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    );
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-pageflip-page-id", /\S/u);
    await expect(page.getByRole("article")).toBeVisible();

    await book.getByRole("button", { name: "Next journal page" }).click();
    await waitForPageFlipRead(book);
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-pageflip-page-id", /\S/u);
    await expect(page.getByRole("article")).toBeVisible();

    const targetCopies = await book.evaluate((element) =>
      Array.from(element.querySelectorAll<HTMLElement>("[data-pageflip-role]")).map((target) => {
        return {
          role: target.dataset.pageflipRole ?? null,
          current: target.dataset.pageflipCurrent ?? null,
          lifecycle: target.dataset.pageflipLifecycle ?? null,
          isInteractive: !target.hasAttribute("inert") && target.getAttribute("aria-hidden") !== "true",
          hasTargetAuthority: target.querySelector("[data-scene-target-id]") !== null,
        };
      }),
    );
    expect(targetCopies.some((copy) => copy.role === "source" && !copy.hasTargetAuthority)).toBe(true);
    expect(
      targetCopies.filter(
        (copy) =>
          copy.role === "primary" && copy.current === "true" && copy.lifecycle === "visible" && copy.isInteractive,
      ),
    ).toHaveLength(1);
    await expectDisqualifiedPageFlipCopiesHidden(page);
  });
});

test.describe("Project Lanternwake Phase 2 showcase tombstones", () => {
  test("deprecated journal and page-turn rows name their replacements without creating a fake Director receipt", async ({
    page,
  }) => {
    await openShowcase(page);
    const book = await waitForStPageFlip(page);
    const receipt = page.getByRole("region", { name: "Latest development presentation receipt" });

    await page.getByLabel("Scene").selectOption("manual-flip");
    await expect(page.getByText(/Replaced by PageFlipBook-manual-controls\./)).toBeVisible();
    await page.getByRole("button", { name: "Play selected scene" }).click();
    await expect(page.getByText("Page 2 of 4")).toBeVisible();
    await expectStPageFlipOwnsTurn(book);
    await expect(receipt).toContainText("No presentation receipt yet.");
    await expect(metricValue(page, "Scene")).toHaveText("idle");

    await page.getByLabel("Scene").selectOption("programmatic-flip");
    await expect(page.getByText(/Replaced by PageFlipBook-flipTo\./)).toBeVisible();
    await page.getByRole("button", { name: "Play selected scene" }).click();
    await expectActionSpecificTurnLanding(book, "programmatic-riddle");
    await expect(receipt).toContainText("No presentation receipt yet.");
    await expect(metricValue(page, "Scene")).toHaveText("idle");

    await page.getByLabel("Scene").selectOption("journal-open");
    await expect(page.getByText(/Replaced by journal-opening-machine\./)).toBeVisible();
    await page.getByRole("button", { name: "Show replacement" }).click();
    await expect(receipt).toContainText("No presentation receipt yet.");
    await expect(metricValue(page, "Scene")).toHaveText("idle");
    await expect(page.locator('[data-pageflip-runtime-claim="granted"]')).toHaveCount(1);
  });
});

test.describe("Project Lanternwake Phase 2 Captain's Console boundaries", () => {
  test("Captain account entry retains a single canonical sign-in path without a second staff credential form", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "The authentication request runs once in Chromium after isolated-database identity proof.",
    );
    await requireValidationIsolation(page);
    await page.goto("/captain/sign-in");
    const accountEntry = page.getByRole("link", { name: "Continue to account sign-in" });
    await expect(page.getByRole("heading", { name: "Open the Captain's Console" })).toBeVisible();
    await expect(accountEntry).toHaveAttribute("href", "/sign-in?returnTo=%2Fcaptain%2Flibrary");
    await expect(page.getByLabel("Username")).toHaveCount(0);
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await accountEntry.focus();
    await expect(accountEntry).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Create Account" })).toBeFocused();
  });

  test("Voyage creation is modal, keeps focus inside its canonical flow, and restores its exact trigger", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Authenticated Captain focus coverage runs once after isolated-database identity proof.",
    );
    test.skip(
      !process.env.GM_USERNAME || !process.env.GM_PASSWORD,
      "The isolated Captain credentials are required for portal coverage.",
    );
    await requireValidationIsolation(page);
    await enterCaptainWorkspace(page);
    const trigger = page.getByRole("button", { name: "Create a Voyage" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: "Close Voyage wizard" });

    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.locator('xpath=ancestor-or-self::*[@aria-hidden="true" or @inert]')).toHaveCount(0);
    await expect(dialog.getByRole("heading")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a committed Voyage creation restores focus to its exact Captain's Console trigger", async ({ page }) => {
    test.setTimeout(90_000);
    await requireValidationIsolation(page);
    await enterCaptainWorkspace(page);
    const trigger = page.getByRole("button", { name: "Create a Voyage" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator(".wizard-choice-grid button").first().click();
    await dialog.getByRole("button", { name: "Continue to Configure Voyage" }).click();
    await dialog.getByLabel("Voyage name").fill(`Focused Voyage ${crypto.randomUUID().slice(0, 8)}`);
    await dialog.getByRole("button", { name: "Continue to Add Crew" }).click();
    await dialog.getByLabel("Crew member name").fill(`Focused Crew ${crypto.randomUUID().slice(0, 8)}`);
    await dialog.getByRole("button", { name: "Continue to Invitation access" }).click();
    await dialog.getByRole("button", { name: "Continue to Delivery" }).click();
    await dialog.getByRole("button", { name: "Continue to Review" }).click();
    await dialog.getByRole("button", { name: "Create Voyage and invitations" }).click();
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("status")).toContainText("created together");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect(trigger).toBeFocused();
  });
});

test.describe("Project Lanternwake Phase 2 Player integration evidence gaps", () => {
  test("the canonical Journal publishes one readable Passage only after its PageFlip boundary is ready", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const fixture = readPreseededPhase3FixtureFromEnv("CHAPTER_RELEASED");
    await openReadOnlyPhase3Player(page, fixture, "journal", { skipOpening: false });
    const journal = page.locator(".chronicle-journal-shell");
    const book = journal.locator('.main-journal-book[data-pageflip-book-id="physical-journal"]');
    await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    await expect(journal).toHaveAttribute("data-page-flip-readiness", "ready");
    await expectStPageFlipOwnsTurn(book);
    await expect(
      book.locator('[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]'),
    ).toHaveCount(1);
    await expect(book.locator('[data-pageflip-role="source"] [data-scene-target-id]')).toHaveCount(0);
    await expectDisqualifiedPageFlipCopiesHidden(page);
  });

  test("a stale PageFlip clone never becomes an interactive Passage or acquires authority", async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = readPreseededPhase3FixtureFromEnv("CHAPTER_RELEASED");
    await openReadOnlyPhase3Player(page, fixture, "journal", { skipOpening: false });
    const book = page.locator('.main-journal-book[data-pageflip-book-id="physical-journal"]');
    await expectStPageFlipOwnsTurn(book);
    const primary = book.locator(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    );
    await expect(primary).toHaveCount(1);
    await primary.evaluate((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.dataset.phase2StaleClone = "true";
      clone.removeAttribute("data-pageflip-current");
      clone.removeAttribute("data-pageflip-primary");
      element.parentElement?.append(clone);
    });
    const stale = book.locator('[data-phase2-stale-clone="true"]');
    await expect(stale).toHaveCount(1);
    await expect(stale).toHaveAttribute("aria-hidden", "true");
    await expect(stale).toHaveAttribute("inert", "");
    await expect(stale.locator("[data-scene-target-id], [data-scene-instance], [data-animation-claim-id]")).toHaveCount(
      0,
    );
    await book.getByRole("button", { name: "Next journal page" }).click();
    await waitForPageFlipRead(book);
    await expect(primary).toHaveCount(1);
    await expectDisqualifiedPageFlipCopiesHidden(page);
  });
});

test.describe("Project Lanternwake Phase 2 required viewports", () => {
  for (const viewport of requiredViewports) {
    test(`${viewport.label} keeps showcase, PageFlip fallback, and access controls readable without horizontal overflow`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await openShowcase(page, "reduce");
      await expect(showcaseBook(page)).toHaveAttribute("data-pageflip-status", "reduced");
      await expect(page.getByLabel("Scene")).toBeVisible();
      await expect(page.getByRole("button", { name: "Play selected scene" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Next journal page" })).toBeVisible();
      expect(await horizontalOverflow(page), `${viewport.label} showcase overflow`).toBeLessThanOrEqual(1);
      await page.getByLabel("Scene").focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Play selected scene" })).toBeFocused();

      const accountPage = await context.newPage();
      try {
        await accountPage.setViewportSize(viewport);
        await accountPage.goto("/captain/sign-in");
        const accountEntry = accountPage.getByRole("link", { name: "Continue to account sign-in" });
        await expect(accountPage.getByRole("heading", { name: "Open the Captain's Console" })).toBeVisible();
        await expect(accountEntry).toBeVisible();
        await expect(accountPage.getByLabel("Username")).toHaveCount(0);
        expect(
          await horizontalOverflow(accountPage),
          `${viewport.label} Captain account entry overflow`,
        ).toBeLessThanOrEqual(1);
        await accountEntry.focus();
        await expect(accountEntry).toBeFocused();
        const createAccount = accountPage.getByRole("link", { name: "Create Account" });
        await expect(createAccount).toHaveAttribute("href", "/register");
        await createAccount.focus();
        await expect(createAccount).toBeFocused();
      } finally {
        await accountPage.close();
      }
    });
  }
});

async function openPlayerJournalEntry(page: Page, open: Locator) {
  const shell = page.locator(".voyage-shell");
  await expect
    .poll(
      async () => {
        if ((await shell.getAttribute("data-journal-phase")) === "JOURNAL_READY") return "ready";
        return (await open.isVisible().catch(() => false)) ? "open" : "pending";
      },
      // The governed isolated runtime can still be hydrating the Player
      // snapshot after invitation confirmation. Wait for the visible product
      // entry state instead of treating a healthy, bounded first load as a
      // stale PageFlip-generation failure.
      { timeout: 30_000 },
    )
    .not.toBe("pending");
  if ((await shell.getAttribute("data-journal-phase")) !== "JOURNAL_READY") await open.click();
}

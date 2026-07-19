import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  installPhase3EvidenceProbe,
  readPreseededPhase3BaseFixture,
  readPreseededPhase3FixtureFromEnv,
  waitForPhase3Receipt,
  type Phase3CaseFixture,
  type Phase3EventType,
  type Phase3PlayerSection,
  type Phase3ReceiptEvidence,
} from "./fixtures/lanternwake-phase3";

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

async function signInQuartermaster(page: Page) {
  expect(process.env.GM_USERNAME, "GM_USERNAME is required for the isolated Quartermaster fixture.").toBeTruthy();
  expect(process.env.GM_PASSWORD, "GM_PASSWORD is required for the isolated Quartermaster fixture.").toBeTruthy();
  await page.goto("/quartermaster");
  await page.getByLabel("Captain's name").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(page.locator(".quartermaster-shell:not(.loading-quarters)")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^Sequence \d+$/)).toBeVisible();
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

async function openDefaultPlayerJournal(page: Page) {
  expect(
    process.env.PLAYER_ACCESS_CODE,
    "PLAYER_ACCESS_CODE is required for the isolated Player fixture.",
  ).toBeTruthy();
  await page.goto("/tale/development-forever-treasure");
  await page.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  await page.getByRole("button", { name: "Open the journal" }).click();
  const open = page.getByRole("button", { name: "Open the journal" });
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) await skip.click();
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

async function openReadOnlyPhase3Player(page: Page, fixture: Phase3CaseFixture, section: Phase3PlayerSection) {
  await installReadOnlyPlayerNetwork(page, fixture);
  await page.addInitScript(({ deviceId }) => {
    localStorage.setItem("forever-device", deviceId);
    localStorage.setItem("forever-motion", "full");
    localStorage.setItem("forever-muted", "true");
  }, fixture);
  await page.context().addCookies([
    {
      name: "forever_player",
      value: fixture.playerAccessId,
      url: String(test.info().project.use.baseURL ?? "http://127.0.0.1:3100"),
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto(`${fixture.path}?section=${section}&journalSpeed=0.25`);
  const open = page.getByRole("button", { name: "Open the journal" });
  if (await open.isVisible().catch(() => false)) {
    await open.click();
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) await skip.click();
  }
  await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
  await expect(page.locator(`.voyage-shell.view-${section}`)).toBeVisible();
  await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
}

async function readOnlyReplayControl(page: Page, eventId: string) {
  const history = page.locator("[data-presentation-history]");
  await expect(history).toBeVisible();
  const details = history.locator("details");
  if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
  const replay = history.locator(`[data-replay-event-id="${eventId}"]`);
  await expect(replay).toBeVisible();
  return replay;
}

function successfulLocalObservation(receipt: Phase3ReceiptEvidence, targetKey: string) {
  return receipt.targetReport?.observations.find((observation) => observation.targetKey === targetKey);
}

async function addUnregisteredStaleSibling(target: Locator, identityAttribute: string) {
  await target.evaluate((element, attribute) => {
    const clone = element.cloneNode(true) as HTMLElement;
    for (const candidate of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))]) {
      for (const authority of [
        "data-scene-target-id",
        "data-scene-instance",
        "data-scene-instance-id",
        "data-animation-claim-id",
      ])
        candidate.removeAttribute(authority);
    }
    clone.setAttribute(attribute, "phase2-stale-sibling");
    clone.dataset.phase2StaleSibling = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");
    element.closest("[data-player-experience-root]")?.append(clone);
  }, identityAttribute);
}

async function beginKeyedStyleProbe(page: Page, exact: Locator) {
  await exact.evaluate((element) => {
    element.setAttribute("data-phase2-keyed-probe", "exact");
    const root = element.closest<HTMLElement>("[data-player-experience-root]");
    const stale = root?.querySelector<HTMLElement>('[data-phase2-stale-sibling="true"]');
    stale?.setAttribute("data-phase2-keyed-probe", "stale");
    const counts = { exact: 0, stale: 0 };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type !== "attributes" || record.attributeName !== "style") continue;
        const key = (record.target as HTMLElement).dataset.phase2KeyedProbe;
        if (key === "exact" || key === "stale") counts[key] += 1;
      }
    });
    if (root) observer.observe(root, { attributes: true, attributeFilter: ["style"], subtree: true });
    (
      window as typeof window & {
        __phase2KeyedStyleProbe?: { observer: MutationObserver; counts: typeof counts };
      }
    ).__phase2KeyedStyleProbe = { observer, counts };
  });
}

async function keyedStyleProbeCounts(page: Page) {
  return page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __phase2KeyedStyleProbe?: {
          observer: MutationObserver;
          counts: { exact: number; stale: number };
        };
      }
    ).__phase2KeyedStyleProbe;
    if (!probe) throw new Error("The keyed style probe is absent.");
    return { ...probe.counts };
  });
}

async function stopKeyedStyleProbe(page: Page) {
  return page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __phase2KeyedStyleProbe?: {
          observer: MutationObserver;
          counts: { exact: number; stale: number };
        };
      }
    ).__phase2KeyedStyleProbe;
    if (!probe) throw new Error("The keyed style probe is absent.");
    probe.observer.disconnect();
    return { ...probe.counts };
  });
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
    browserName,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1_440, height: 900 });

    if (browserName === "chromium") {
      await requireValidationIsolation(page);
      await signInQuartermaster(page);
      await page.addInitScript(() => localStorage.setItem("forever-motion", "full"));
      await openDefaultPlayerJournal(page);
      const book = page.locator(".main-journal-book");
      await expectStPageFlipOwnsTurn(book);
      const beforeRevision = await pageFlipBoundaryEvidence(book);
      expect(beforeRevision.contentRevision).toMatch(/\S/u);
      expect(beforeRevision.cloneGeneration).toMatch(/^\d+$/u);
      expect(beforeRevision.sourceGeneration).toMatch(/^\d+$/u);

      await publishDefaultProgression(page);
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
      return;
    }

    const fixture = readPreseededPhase3BaseFixture();
    await installPhase3EvidenceProbe(page);
    await openReadOnlyPhase3Player(page, fixture, "journal");
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

  test("only the current visible primary page target qualifies in the public target-resolution receipt", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installPhase3EvidenceProbe(page);
    const fixture = readPreseededPhase3FixtureFromEnv("SIDE_QUEST_DISCOVERED");
    const eventId = fixture.prerequisiteEventId!;
    await openReadOnlyPhase3Player(page, fixture, "quests");
    const book = page.locator('.quest-page-book[data-pageflip-book-id="side-quest-ledger"]');
    await expectStPageFlipOwnsTurn(book);

    const summaryPageId = `${fixture.sideQuestKey}-summary`;
    for (let turn = 0; turn < 2; turn += 1) {
      await book.getByRole("button", { name: "Next journal page" }).click();
      await waitForPageFlipRead(book);
    }
    const current = book.locator(
      `[data-pageflip-role="primary"][data-pageflip-current="true"]` +
        `[data-pageflip-lifecycle="visible"][data-pageflip-page-id="${summaryPageId}"]`,
    );
    await expect(current).toHaveCount(1);
    await expect(current.locator('[data-scene-part="quest-note-new"][data-scene-target-id]')).toHaveCount(1);

    const replay = await readOnlyReplayControl(page, eventId);
    await replay.click();
    const receipt = await waitForPhase3Receipt(page, eventId, { source: "replay" });
    expect(receipt.localEnhancement).toEqual({
      expected: true,
      section: "quests",
      status: "ran",
      targetKeys: expect.arrayContaining(["local-quest-note", "local-quest-red-thread"]),
    });
    for (const targetKey of ["local-quest-note", "local-quest-red-thread"]) {
      expect(successfulLocalObservation(receipt, targetKey)).toMatchObject({
        targetKey,
        candidateCount: 1,
        matchedCount: 1,
        visibleCount: 1,
        duplicateCount: 0,
        ownershipRejectedCount: 0,
      });
    }

    const targetCopies = await book.evaluate((element) =>
      Array.from(
        element.querySelectorAll<HTMLElement>('[data-scene-part="quest-note-new"][data-scene-target-key]'),
      ).map((target) => {
        const boundary = target.closest<HTMLElement>("[data-pageflip-role]");
        return {
          role: boundary?.dataset.pageflipRole ?? null,
          current: boundary?.dataset.pageflipCurrent ?? null,
          lifecycle: boundary?.dataset.pageflipLifecycle ?? null,
          hasTargetAuthority: target.hasAttribute("data-scene-target-id"),
        };
      }),
    );
    expect(targetCopies.some((copy) => copy.role === "source" && !copy.hasTargetAuthority)).toBe(true);
    expect(
      targetCopies.filter(
        (copy) =>
          copy.role === "primary" && copy.current === "true" && copy.lifecycle === "visible" && copy.hasTargetAuthority,
      ),
    ).toHaveLength(1);
    expect(
      targetCopies.filter(
        (copy) => ["source", "temporary", "unproven"].includes(copy.role ?? "") && copy.hasTargetAuthority,
      ),
    ).toEqual([]);
    await expectDisqualifiedPageFlipCopiesHidden(page);
    expect(receipt.targetReport?.observations.every((observation) => observation.duplicateCount === 0)).toBe(true);
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

test.describe("Project Lanternwake Phase 2 Quartermaster boundaries", () => {
  test("login is aria-busy, single-flight, and returns focus after a failed key", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "The authentication request runs once in Chromium after isolated-database identity proof.",
    );
    await requireValidationIsolation(page);
    let releaseLogin!: () => void;
    const loginGate = new Promise<void>((resolve) => {
      releaseLogin = resolve;
    });
    let loginRequests = 0;
    await page.route("**/api/gm/login", async (route) => {
      loginRequests += 1;
      await loginGate;
      await route.continue();
    });

    await page.goto("/quartermaster");
    const form = page.locator("form");
    await page.getByLabel("Captain's name").fill(`invalid-${crypto.randomUUID().slice(0, 8)}`);
    await page.getByLabel("Passphrase").fill(`invalid-${crypto.randomUUID()}`);
    const started = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/api/gm/login" && request.method() === "POST",
    );
    await page.getByRole("button", { name: "Enter the chart room" }).click();
    await started;
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: /Turning the key/ })).toBeDisabled();
    await form.dispatchEvent("submit");
    await expect.poll(() => loginRequests).toBe(1);
    releaseLogin();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(form).toHaveAttribute("aria-busy", "false");
    await expect(page.getByLabel("Captain's name")).toBeFocused();
    expect(loginRequests).toBe(1);
  });

  test("confirmation portal is modal, isolates background, wraps Tab, and restores the exact trigger", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Authenticated Quartermaster focus coverage runs once after isolated-database identity proof.",
    );
    test.skip(
      !process.env.GM_USERNAME || !process.env.GM_PASSWORD,
      "The isolated Quartermaster credentials are required for portal coverage.",
    );
    await requireValidationIsolation(page);
    await signInQuartermaster(page);
    const trigger = page.getByRole("button", { name: "Prepare Chapter" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Prepare Chapter" });
    const main = page.locator("main.quartermaster-shell");
    const confirm = dialog.getByRole("button", { name: "Confirm action" });
    const cancel = dialog.getByRole("button", { name: "Cancel" });

    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(main).toHaveAttribute("aria-hidden", "true");
    await expect(main).toHaveAttribute("inert", "");
    await expect(dialog.locator('xpath=ancestor-or-self::*[@aria-hidden="true" or @inert]')).toHaveCount(0);
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(main).not.toHaveAttribute("aria-hidden", "true");
    await expect(main).not.toHaveAttribute("inert", "");

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a committed Quartermaster confirmation restores focus to its exact command trigger", async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
    let mockedCommandRequests = 0;
    let mockSequence = 41;
    if (browserName !== "chromium") {
      const mockStatus = () => ({
        csrfToken: "read-only-mocked-csrf",
        campaign: {
          slug: "read-only-focus-proof",
          title: "Read-only focus proof",
          status: "ACTIVE",
          sequence: mockSequence,
        },
        chapter: { ordinal: 1, state: "ACTIVE", title: "Read-only chapter" },
        playerConnected: false,
        events: [],
        inventory: [],
        sideQuest: null,
        preview: { chapter: { objective: "Keep focus truthful." } },
      });
      await page.route("**/api/gm/login", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
      );
      await page.route("**/api/gm/status", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockStatus()) }),
      );
      await page.route("**/api/gm/commands", async (route) => {
        mockedCommandRequests += 1;
        mockSequence += 1;
        const event = { id: "read-only-mocked-event", type: "PLAYER_LOG_ENTRY_ADDED", sequence: mockSequence };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            kind: "PROGRESSION_EVENT",
            correlationId: "read-only-mocked-correlation",
            persistence: "COMMITTED",
            publication: "PROCESS_PUBLISHED",
            delivery: "PUBLISHED",
            deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
            playerDelivery: "UNCONFIRMED",
            playerPresentation: "UNCONFIRMED",
            playerAcknowledgment: "UNCONFIRMED",
            event,
            playerEvent: event,
          }),
        });
      });
    } else {
      await requireValidationIsolation(page);
    }

    await signInQuartermaster(page);
    const trigger = page.getByRole("button", { name: "Add Player Log Entry" });
    const triggerIdentity = crypto.randomUUID();
    await trigger.evaluate((element, identity) => {
      (element as HTMLElement).dataset.phase2CommandTriggerIdentity = identity;
    }, triggerIdentity);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add Player Log Entry" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm action" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole("status").filter({ hasText: /Event .* recorded at sequence/u })).toBeVisible();
    await expect(trigger).toHaveAttribute("data-phase2-command-trigger-identity", triggerIdentity);
    await expect(trigger).toBeFocused();
    if (browserName !== "chromium") expect(mockedCommandRequests).toBe(1);
  });
});

test.describe("Project Lanternwake Phase 2 Player integration evidence gaps", () => {
  test("the chapter ceremony host is published only after its complete ready target set is registered", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await installPhase3EvidenceProbe(page);
    const fixture = readPreseededPhase3FixtureFromEnv("CHAPTER_RELEASED");
    const eventId = fixture.prerequisiteEventId!;
    await openReadOnlyPhase3Player(page, fixture, "journal");
    const journalHost = page.locator('.journal-workspace[data-scene-host-kind="player-progression"]');
    await expect(journalHost).toHaveCount(1);

    const ceremonyTargetCounts = {
      "journal-stage": 1,
      "sealed-parchment": 1,
      "ink-heading": 2,
      "ink-story": 1,
      "ink-objective": 1,
      "ink-riddle": 1,
      "page-light": 1,
      seal: 1,
      "seal-crack": 1,
      "seal-fragment": 2,
      "route-path": 1,
      "map-fog": 1,
      quill: 1,
      "quill-path": 1,
    } as const;
    for (const part of Object.keys(ceremonyTargetCounts)) {
      if (part === "journal-stage") continue;
      await expect(journalHost.locator(`[data-scene-part="${part}"][data-scene-target-id]`)).toHaveCount(0);
    }

    const replay = await readOnlyReplayControl(page, eventId);
    await replay.click();
    await expect
      .poll(
        () =>
          journalHost.evaluate(
            (element, expected) =>
              Object.fromEntries(
                Object.keys(expected).map((part) => [
                  part,
                  element.querySelectorAll(`[data-scene-part="${part}"][data-scene-target-id]`).length,
                ]),
              ),
            ceremonyTargetCounts,
          ),
        { message: "The journal must publish its ceremony capability only after every target is registered." },
      )
      .toEqual(ceremonyTargetCounts);

    const receipt = await waitForPhase3Receipt(page, eventId, { source: "replay" });
    expect(receipt.localEnhancement).toEqual({
      expected: true,
      section: "journal",
      status: "ran",
      targetKeys: ["local-sealed-parchment"],
    });
    expect(successfulLocalObservation(receipt, "local-sealed-parchment")).toMatchObject({
      candidateCount: 1,
      matchedCount: 1,
      visibleCount: 1,
      duplicateCount: 0,
      ownershipRejectedCount: 0,
    });
    expect(receipt.targetReport).toMatchObject({ requiredSatisfied: true, failures: [] });
  });

  test("duplicate persistent/event parts and keyed artifact, map, and log handoffs never cross or retain stale siblings", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await installPhase3EvidenceProbe(page);
    const cases = [
      {
        eventType: "ARTIFACT_AWARDED",
        section: "treasures",
        exactTarget: (fixture: Phase3CaseFixture) => `.artifact-silhouette[data-artifact-key="${fixture.artifactKey}"]`,
        identityAttribute: "data-artifact-key",
        expectedLocalKeys: ["local-artifact-slot"],
      },
      {
        eventType: "MAP_LOCATION_REVEALED",
        section: "chart",
        exactTarget: (fixture: Phase3CaseFixture) => `[data-marker-visual-key="${fixture.mapLocationKey}"]`,
        identityAttribute: "data-marker-visual-key",
        expectedLocalKeys: ["local-map-marker"],
      },
      {
        eventType: "PLAYER_LOG_ENTRY_ADDED",
        section: "log",
        exactTarget: (_fixture: Phase3CaseFixture, eventId: string) => `.log-fresh-ink[data-event-id="${eventId}"]`,
        identityAttribute: "data-event-id",
        expectedLocalKeys: ["local-log-entry", "local-log-symbol"],
      },
    ] as const satisfies readonly {
      eventType: Phase3EventType;
      section: Phase3PlayerSection;
      exactTarget: (fixture: Phase3CaseFixture, eventId: string) => string;
      identityAttribute: string;
      expectedLocalKeys: readonly string[];
    }[];

    for (const keyedCase of cases) {
      const fixture = readPreseededPhase3FixtureFromEnv(keyedCase.eventType);
      const eventId = fixture.prerequisiteEventId!;
      await openReadOnlyPhase3Player(page, fixture, keyedCase.section);
      const exactTarget = page.locator(keyedCase.exactTarget(fixture, eventId));
      await expect(exactTarget).toHaveCount(1);
      await expect(exactTarget).toHaveAttribute("data-scene-target-id", /\S/u);
      await addUnregisteredStaleSibling(exactTarget, keyedCase.identityAttribute);
      const staleSibling = page.locator('[data-phase2-stale-sibling="true"]');
      await expect(staleSibling).toHaveCount(1);
      await expect(
        staleSibling.locator(
          "[data-scene-target-id], [data-scene-instance], [data-scene-instance-id], [data-animation-claim-id]",
        ),
      ).toHaveCount(0);
      await beginKeyedStyleProbe(page, exactTarget);

      const replay = await readOnlyReplayControl(page, eventId);
      await replay.click();
      await expect
        .poll(async () => (await keyedStyleProbeCounts(page)).exact, {
          message: `${keyedCase.eventType} must animate its exact exported keyed target.`,
        })
        .toBeGreaterThan(0);
      const receipt = await waitForPhase3Receipt(page, eventId, { source: "replay" });
      const mutations = await stopKeyedStyleProbe(page);
      expect(mutations.exact).toBeGreaterThan(0);
      expect(mutations.stale).toBe(0);
      await expect(staleSibling).toHaveCount(1);

      expect(receipt.localEnhancement).toEqual({
        expected: true,
        section: keyedCase.section,
        status: "ran",
        targetKeys: expect.arrayContaining([...keyedCase.expectedLocalKeys]),
      });
      for (const targetKey of keyedCase.expectedLocalKeys) {
        expect(successfulLocalObservation(receipt, targetKey)).toMatchObject({
          candidateCount: 1,
          matchedCount: 1,
          visibleCount: 1,
          duplicateCount: 0,
          ownershipRejectedCount: 0,
        });
      }
      expect(receipt.targetReport).toMatchObject({ requiredSatisfied: true, failures: [] });
      expect(receipt.targetReport?.observations.every((observation) => observation.duplicateCount === 0)).toBe(true);
      await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
    }
  });
});

test.describe("Project Lanternwake Phase 2 required viewports", () => {
  for (const viewport of requiredViewports) {
    test(`${viewport.label} keeps showcase, PageFlip fallback, and access controls readable without horizontal overflow`, async ({
      page,
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

      await page.goto("/quartermaster");
      await expect(page.getByRole("heading", { name: "Quartermaster's Log" })).toBeVisible();
      await expect(page.getByLabel("Captain's name")).toBeVisible();
      await expect(page.getByLabel("Passphrase")).toBeVisible();
      await expect(page.getByRole("button", { name: "Enter the chart room" })).toBeVisible();
      expect(await horizontalOverflow(page), `${viewport.label} Quartermaster overflow`).toBeLessThanOrEqual(1);
      await page.getByLabel("Captain's name").focus();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Passphrase")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Enter the chart room" })).toBeFocused();
    });
  }
});

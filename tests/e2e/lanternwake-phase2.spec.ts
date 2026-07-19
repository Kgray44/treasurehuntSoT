import { expect, test, type Locator, type Page } from "@playwright/test";

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

  test.fixme(
    "content revision and orientation changes revoke the old generation and expose zero retained references",
    async () => {
      // Evidence gap: the current public showcase reports generations but has no control that changes page content revision.
    },
  );

  test.fixme(
    "only the current visible primary page target qualifies in the public target-resolution receipt",
    async () => {
      // Evidence gap: current PageFlip pages contain no deliberate cinematic target and the safe receipt omits target IDs.
    },
  );
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

  test.fixme("a committed Quartermaster confirmation restores focus to its exact command trigger", async () => {
    // Evidence gap: this needs an isolated command fixture with deterministic state and must not share mutation order.
  });
});

test.describe("Project Lanternwake Phase 2 Player integration evidence gaps", () => {
  test.fixme(
    "the chapter ceremony host is published only after its complete ready target set is registered",
    async () => {
      // Evidence gap: ready publication is an internal capability callback; the DOM host marker alone cannot prove it.
    },
  );

  test.fixme(
    "duplicate persistent/event parts and keyed artifact, map, and log handoffs never cross or retain stale siblings",
    async () => {
      // Evidence gap: the current browser fixture has no safe public control for publishing all three exact event kinds.
    },
  );
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

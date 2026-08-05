import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string; email: string; displayName: string };

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH"));
const handoff = JSON.parse(
  readFileSync(
    path.join(taskRoot, "credentials", "owner-correction-round2-walkthrough-credentials.private.json"),
    "utf8",
  ),
) as { password: string; accounts: Record<string, Alias> };
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: journeyId === "V" ? "reduce" : "no-preference" });
});
test.afterAll(async () => db.$disconnect());

test("Journey A: role cards retain structural geometry", async ({ page }) => {
  await begin(page);
  const cards = page.locator(".role-object-card");
  await expect(cards).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const card = cards.nth(index);
    const object = card.locator(".role-object");
    const before = await object.boundingBox();
    await card.hover();
    await page.waitForTimeout(420);
    const after = await object.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(0.5);
  }
  await capture(page, "HP-OWCR2-EV-B-ROLE-CARDS-HOVER");
});

test("Journey B: account menu has perceptible governed opening motion", async ({ page }) => {
  const account = await signIn(page, "SERA");
  const button = page.getByRole("button", { name: account.displayName, exact: true });
  await button.click();
  const menu = page.locator("#shell-account-disclosure");
  const frames: Array<{ opacity: string; transform: string }> = [];
  for (let index = 0; index < 5; index += 1) {
    frames.push(
      await menu.evaluate((node) => {
        const style = getComputedStyle(node);
        return { opacity: style.opacity, transform: style.transform };
      }),
    );
    await page.waitForTimeout(35);
  }
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("data-account-menu-motion", "visible");
  expect(new Set(frames.map((frame) => `${frame.opacity}:${frame.transform}`)).size).toBeGreaterThan(1);
  expect(frames.at(-1)?.opacity).toBe("1");
  await capture(page, "HP-OWCR2-EV-C-ACCOUNT-MENU-OPENING", false);
});

test("Journey C: lantern uses the suspension point and balanced arc", async ({ page }) => {
  await begin(page);
  const lantern = page.locator(".hanging-lantern");
  await expect(lantern).toBeVisible();
  await expect(lantern).toHaveCSS("transform-origin", "47px 0px");
  const samples: number[] = [];
  for (let index = 0; index < 12; index += 1) {
    samples.push(await rotation(lantern));
    await page.waitForTimeout(180);
  }
  expect(Math.min(...samples)).toBeLessThan(-0.5);
  expect(Math.max(...samples)).toBeGreaterThan(0.5);
  await capture(page, "HP-OWCR2-EV-D-LANTERN-NEUTRAL", false);
});

test("Journey D: restrained stars and lifecycle-managed fog are perceptible", async ({ page }) => {
  await begin(page);
  const star = page.locator(".star-field i").first();
  const fog = page.locator(".distant-clouds");
  const firstOpacity = Number(await star.evaluate((node) => getComputedStyle(node).opacity));
  await page.waitForTimeout(900);
  const secondOpacity = Number(await star.evaluate((node) => getComputedStyle(node).opacity));
  expect(Math.abs(firstOpacity - secondOpacity)).toBeGreaterThan(0.015);
  await expect(star).toHaveCSS("animation-name", "harbor-star-twinkle");
  await expect(fog).toHaveCSS("animation-name", "harbor-fog-drift");
  await capture(page, "HP-OWCR2-EV-G-STAR-TWINKLE", false);
});

test("Journey E: Dark restores the Chronicle explainer surface", async ({ page }) => {
  await begin(page);
  await page.evaluate(() => (document.documentElement.dataset.voyageTheme = "dark"));
  const explainer = page.locator(".gateway-explainer");
  await expect(explainer.getByRole("heading", { name: "What is a Chronicle?" })).toBeVisible();
  const luminance = await backgroundLuminance(explainer, "--surface-default");
  expect(luminance).toBeLessThan(0.2);
  await capture(page, "HP-OWCR2-EV-I-DARK-WHAT-IS-A-CHRONICLE");
});

test("Journey F: explicit Light persists across ordinary gateway navigation", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await accountDestination(page, account, "Preferences");
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("LIGHT");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await capture(page, "HP-OWCR2-EV-J-LIGHT-GATEWAY");
});

test("Journey G: Light covers Community without mixed dark panels", async ({ page }) => {
  await signIn(page, "SERA");
  await setTheme(page, "LIGHT");
  await page.goto("/community");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  expect(await backgroundLuminance(page.locator(".community-harbor"), "--background-primary")).toBeGreaterThan(0.65);
  await capture(page, "HP-OWCR2-EV-K-LIGHT-COMMUNITY");
});

test("Journey H: Light covers Personal Harbor with readable secondary text", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await setTheme(page, "LIGHT");
  await accountDestination(page, account, "Personal Harbor");
  const secondary = page.locator(".personal-harbor__hero p:not(.personal-harbor__eyebrow)").first();
  expect(await contrastRatio(secondary)).toBeGreaterThanOrEqual(4.5);
  await capture(page, "HP-OWCR2-EV-L-LIGHT-PERSONAL-HARBOR");
});

test("Journey I: Sera enters Player Captain and Creator from the actual fixture", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await accountDestination(page, account, "All Workspaces");
  for (const workspace of ["Player", "Captain", "Creator"]) {
    await expect(page.getByRole("link", { name: `Enter ${workspace}` })).toBeVisible();
  }
  await expect(page.getByText("Captain and Creator transitions are paused")).toHaveCount(0);
  await capture(page, "HP-OWCR2-EV-M-SERA-WORKSPACES");
});

test("Journey J: fast Community success has no loading or error flash", async ({ page }) => {
  await begin(page);
  await page.goto("/community/chronicles");
  await expect(page.getByRole("heading", { name: "Chronicles", exact: true })).toBeVisible();
  await expect(page.locator(".ui-loading-state")).toHaveCount(0);
  await expect(page.locator(".community-state--error")).toHaveCount(0);
  await expect(page.getByText("Community results could not be opened")).toHaveCount(0);
  await capture(page, "HP-OWCR2-EV-N-COMMUNITY-FAST-READY");
});

test("Journey K: unresolved Community request reveals loading only after 500 ms", async ({ page }) => {
  await begin(page);
  let release!: () => void;
  let intercepted!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const requestIntercepted = new Promise<void>((resolve) => (intercepted = resolve));
  await page.route("**/community**", async (route) => {
    intercepted();
    await gate;
    await route.continue();
  });
  const navigation = page.getByRole("link", { name: "Community Harbor", exact: true }).click();
  await requestIntercepted;
  await page.waitForTimeout(450);
  await expect(page.locator(".ui-loading-state")).toHaveCount(0);
  await page.waitForTimeout(100);
  await expect(page.locator(".ui-loading-state")).toBeVisible();
  await capture(page, "HP-OWCR2-EV-O-COMMUNITY-DELAYED-LOADING");
  release();
  await navigation;
  await expect(page.locator(".ui-loading-state")).toHaveCount(0);
});

test("Journey L: real Community failure alone shows error and retry recovers", async ({ page }) => {
  await begin(page);
  await page.goto("/community/chronicles");
  let failed = false;
  await page.route("**/api/community/discover**", async (route) => {
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unavailable" }),
      });
    } else await route.continue();
  });
  const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
  await search.fill("dependency test");
  await search.press("Enter");
  await expect(
    page.getByRole("alert").getByRole("heading", { name: "Community results could not be opened" }),
  ).toBeVisible();
  await capture(page, "HP-OWCR2-EV-P-COMMUNITY-REAL-ERROR");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".community-state--error")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No public charts match these criteria" })).toBeVisible();
});

test("Journey M: one existing public Profile satisfies review identity", async ({ page }) => {
  await signIn(page, "REVIEW_ELIGIBLE");
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("form", { name: "Write a review" })).toBeVisible();
  await expect(page.getByText(/Community Profile/u)).toHaveCount(0);
  await capture(page, "HP-OWCR2-EV-Q-PUBLIC-PROFILE-REVIEW");
});

test("Journey N: missing public identity links to setup and returns to composer", async ({ page }) => {
  const account = handoff.accounts.REVIEW_ELIGIBLE;
  await db.communityProfile.deleteMany({ where: { accountId: account.accountId } });
  await db.playerProfile.update({
    where: { accountId: account.accountId },
    data: { handle: null, normalizedHandle: null, defaultVisibility: "REGISTERED_USERS" },
  });
  await signIn(page, "REVIEW_ELIGIBLE");
  const detail = await reviewListingUrl();
  await page.goto(detail);
  await expect(page.getByRole("link", { name: "Set up public Profile" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-R-PUBLIC-PROFILE-SETUP");
  await page.getByRole("link", { name: "Set up public Profile" }).click();
  await page.getByRole("textbox", { name: /Handle/u }).last().fill("review-eligible-return");
  await page.getByLabel("Default visibility").last().selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).last().click();
  await expect(page).toHaveURL(
    new RegExp(`${escapeRegex(new URL(detail, "http://local").pathname)}#community-review-composer$`, "u"),
  );
  await expect(page.getByRole("form", { name: "Write a review" })).toBeVisible();
});

test("Journey O: save and unsave update the visible authoritative count once", async ({ page }) => {
  await signIn(page, "SERA");
  await page.goto("/community");
  const listing = await reviewListing();
  const card = page
    .locator(".community-card")
    .filter({ has: page.getByRole("heading", { name: listing.title }) })
    .first();
  const before = await db.communitySave.count({
    where: { subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" },
  });
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByText(`${before + 1} saves`, { exact: false })).toBeVisible();
  await expect
    .poll(() => db.communitySave.count({ where: { subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" } }))
    .toBe(before + 1);
  await capture(page, "HP-OWCR2-EV-S-SAVE-COUNT");
  await card.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(card.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect
    .poll(() => db.communitySave.count({ where: { subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" } }))
    .toBe(before);
});

test("Journey P: rating summary derives average and count from eligible reviews", async ({ page }) => {
  await begin(page);
  await page.goto(await reviewListingUrl());
  await expect(page.getByText("4.0 from 1 review", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("12 saves", { exact: false })).toHaveCount(0);
  await capture(page, "HP-OWCR2-EV-T-RATING-SUMMARY");
});

test("Journey Q: exact completion is server-derived and client forgery is denied", async ({ page }) => {
  await signIn(page, "SERA");
  const listing = await reviewListing();
  await page.goto(`/community/${encodeURIComponent(listing.slug)}`);
  await expect(page.getByText(/Complete this exact Chronicle release/u)).toBeVisible();
  const result = await page.evaluate(async (listingId) => {
    const session = await fetch("/api/player/session").then((response) => response.json());
    const response = await fetch("/api/community/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": session.csrfToken },
      body: JSON.stringify({ listingId, rating: 5, spoilerFreeBody: "Forged client completion must never qualify." }),
    });
    return { status: response.status, body: await response.json() };
  }, listing.id);
  expect(result.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(result.body)).toContain("Complete this exact Chronicle release");
  await capture(page, "HP-OWCR2-EV-U-COMPLETION-VERIFIED-REVIEW");
});

test("Journey R: Chronicle preview exposes practical facts and separates Start", async ({ page }) => {
  await begin(page);
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("heading", { name: "Chronicle preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practical requirements" })).toBeVisible();
  await expect(page.getByText(/Preview shows public, preview-safe details only/u)).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Chronicle" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-V-CHRONICLE-PREVIEW-EXPANDED");
});

test("Journey S: Passport history offers optional later review entry", async ({ page }) => {
  await signIn(page, "REVIEW_ELIGIBLE");
  await page.goto("/passport/history");
  await expect(page.getByRole("link", { name: "Review Chronicle" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-W-PASSPORT-REVIEW-ENTRY");
});

test("Journey T: semantic body and metadata remain distinct and readable at zoom", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await setTheme(page, "LIGHT");
  await accountDestination(page, account, "Personal Harbor");
  await page.evaluate(() => (document.body.style.zoom = "2"));
  const root = page.locator("html");
  const tokens = await root.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      "--text-heading",
      "--text-body",
      "--text-inactive",
      "--text-metadata",
      "--text-secondary",
      "--text-disabled",
    ].map((name) => style.getPropertyValue(name).trim());
  });
  expect(new Set(tokens).size).toBe(tokens.length);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
  await capture(page, "HP-OWCR2-EV-X-PERSONAL-HARBOR-CONTRAST");
});

test("Journey U: critical Community and Profile setup fit mobile", async ({ page }) => {
  await signIn(page, "SERA");
  await page.goto("/community");
  await capture(page, "HP-OWCR2-EV-Z-MOBILE-COMMUNITY");
  await page.goto("/account/profile");
  await capture(page, "HP-OWCR2-EV-AA-MOBILE-PROFILE-SETUP");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
});

test("Journey V: reduced motion produces a coherent static ambient composition", async ({ page }) => {
  await begin(page);
  const star = page.locator(".star-field i").first();
  const fog = page.locator(".distant-clouds");
  await expect(star).toHaveCSS("animation-name", "none");
  await expect(fog).toHaveCSS("animation-name", "none");
  const lantern = page.locator(".hanging-lantern");
  const first = await lantern.getAttribute("style");
  await page.waitForTimeout(600);
  expect(await lantern.getAttribute("style")).toBe(first);
  await capture(page, "HP-OWCR2-EV-AB-REDUCED-MOTION", false);
});

test("Journey W: ordinary product UI exposes no synthetic email simulator", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await accountDestination(page, account, "Personal Information");
  const text = await page.getByRole("main").last().innerText();
  expect(text).not.toMatch(/synthetic outbox|email simulator|test delivery|provider simulator/iu);
  await expect(page.getByText(account.email, { exact: true }).first()).toBeVisible();
  await capture(page, "HP-OWCR2-EV-AE-FULL-ROUND2-REGRESSION");
});

async function begin(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator("main:visible").last()).toBeVisible();
}

async function signIn(page: Page, alias: string) {
  const account = handoff.accounts[alias];
  if (!account) throw new Error(`Unknown Round 2 alias: ${alias}`);
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Sign In", exact: true }));
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  return account;
}

async function accountMenu(page: Page, label: string) {
  const button =
    label === "Account"
      ? page.getByRole("button", { name: /^(Account|Session ended)$/u })
      : page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  const menu = page.locator("#shell-account-disclosure");
  await expect(menu).toBeVisible();
  return menu;
}

async function accountDestination(page: Page, account: Alias, label: string) {
  const menu = await accountMenu(page, account.displayName);
  let link = menu.getByRole("link", { name: label, exact: true });
  if ((await link.count()) === 0) {
    await settledLink(page, menu.getByRole("link", { name: "Personal Harbor", exact: true }));
    link = page
      .getByRole("navigation", { name: "Personal Harbor sections" })
      .getByRole("link", { name: label, exact: true });
  }
  await settledLink(page, link);
}

async function settledLink(page: Page, link: Locator) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Visible link has no destination.");
  await link.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(href, page.url()).pathname);
  await expect(page.locator("main:visible").last()).toBeVisible();
}

async function setTheme(page: Page, theme: "LIGHT" | "DARK") {
  await page.goto("/account/preferences");
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(theme);
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", theme.toLocaleLowerCase());
}

async function reviewListing() {
  const listing = await db.communityListing.findFirst({
    where: {
      itemType: "CHRONICLE",
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      currentRelease: { sourcePublishedTaleVersionId: { not: null } },
    },
    select: { id: true, slug: true, title: true },
    orderBy: { id: "asc" },
  });
  if (!listing) throw new Error("Round 2 review listing is unavailable.");
  return listing;
}

async function reviewListingUrl() {
  return `/community/${encodeURIComponent((await reviewListing()).slug)}`;
}

async function rotation(locator: Locator) {
  return locator.evaluate((node) => {
    const transform = getComputedStyle(node).transform;
    if (transform === "none") return 0;
    const matrix = new DOMMatrixReadOnly(transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  });
}

async function backgroundLuminance(locator: Locator, token: string) {
  const color = await locator.evaluate(
    (_node, property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    token,
  );
  return luminance(color);
}

async function contrastRatio(locator: Locator) {
  return locator.evaluate((node) => {
    const luminanceInPage = (color: string) => {
      const values = color
        .match(/[\d.]+/gu)
        ?.slice(0, 3)
        .map(Number) ?? [0, 0, 0];
      const linear = values.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const style = getComputedStyle(node);
    const foreground = luminanceInPage(style.color);
    let parent: Element | null = node;
    let background = "rgb(255,255,255)";
    while (parent) {
      const candidate = getComputedStyle(parent).backgroundColor;
      if (!candidate.endsWith(", 0)") && candidate !== "rgba(0, 0, 0, 0)") {
        background = candidate;
        break;
      }
      parent = parent.parentElement;
    }
    const backdrop = luminanceInPage(background);
    return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05);
  });
}

function luminance(color: string) {
  const values = color.startsWith("#")
    ? (color
        .slice(1)
        .match(/.{2}/gu)
        ?.slice(0, 3)
        .map((value) => Number.parseInt(value, 16)) ?? [0, 0, 0])
    : (color
        .match(/[\d.]+/gu)
        ?.slice(0, 3)
        .map(Number) ?? [0, 0, 0]);
  const linear = values.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function capture(page: Page, evidenceId: string, fullPage = true) {
  const screenshotRoot = path.join(taskRoot, "screenshots", `round2-${journeyId}`);
  const reportRoot = path.join(taskRoot, "reports", "owner-correction-round2-journeys");
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });
  const screenshotPath = path.join(screenshotRoot, `${evidenceId}.png`);
  const image = await page.screenshot({ path: screenshotPath, fullPage, caret: "hide" });
  await writeFile(
    path.join(reportRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion: "homeport-phase7-owner-correction-round2-v1",
        databasePath,
        screenshotPath,
        screenshotSha256: createHash("sha256").update(image).digest("hex"),
        browser: "Playwright Chromium",
        viewport: page.viewportSize(),
        route: new URL(page.url()).pathname,
        title: await page.title(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

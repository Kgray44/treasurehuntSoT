import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string; email: string; displayName: string };
type Delivery = { purpose: string; email: string; token?: string; accountId: string; detail?: string };

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH"));
const outboxPath = path.join(taskRoot, "synthetic-outbox", `round2-journey-${journeyId}.jsonl`);
const handoff = JSON.parse(
  readFileSync(
    path.join(taskRoot, "credentials", "owner-correction-round2-walkthrough-credentials.private.json"),
    "utf8",
  ),
) as { password: string; accounts: Record<string, Alias> };
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  rmSync(outboxPath, { force: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
});
test.afterAll(async () => db.$disconnect());

test("Journey C: Role-card first paint and hover", async ({ page }) => {
  await begin(page);
  const cards = page.locator(".role-object-card");
  await expect(cards).toHaveCount(3);
  await capture(page, "HP-OWCR2-EV-A-ROLE-CARDS-FIRST-PAINT");
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
  await cards.nth(2).getByRole("link").focus();
  await expect(cards.nth(2).getByRole("link")).toBeFocused();
  await capture(page, "HP-OWCR2-EV-B-ROLE-CARDS-HOVER");
});

test("Journey D: Account-menu motion", async ({ page }) => {
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
  await writeMotionReceipt("HP-OWCR2-EV-C-ACCOUNT-MENU-OPENING", { frames });
  await capture(page, "HP-OWCR2-EV-C-ACCOUNT-MENU-OPENING", false);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await button.click();
  await settledLink(page, page.locator("#shell-account-disclosure").getByRole("link", { name: "All Workspaces" }));
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const reducedButton = page.getByRole("button", { name: account.displayName, exact: true });
  await reducedButton.click();
  await expect(page.locator("#shell-account-disclosure")).toHaveCSS("animation-name", "none");
});

test("Journey E: Home ambient motion", async ({ page }) => {
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
  await captureAtRotation(page, lantern, "HP-OWCR2-EV-E-LANTERN-LEFT", (value) => value < -0.5);
  await captureAtRotation(page, lantern, "HP-OWCR2-EV-F-LANTERN-RIGHT", (value) => value > 0.5);
  const star = page.locator(".star-field i").first();
  const fog = page.locator(".distant-clouds");
  const starOpacity: number[] = [];
  for (let index = 0; index < 16; index += 1) {
    starOpacity.push(Number(await star.evaluate((node) => getComputedStyle(node).opacity)));
    await page.waitForTimeout(250);
  }
  expect(Math.max(...starOpacity) - Math.min(...starOpacity)).toBeGreaterThan(0.015);
  await expect(star).toHaveCSS("animation-name", "harbor-star-twinkle");
  await expect(fog).toHaveCSS("animation-name", "harbor-fog-drift");
  await capture(page, "HP-OWCR2-EV-G-STAR-TWINKLE", false);
  await capture(page, "HP-OWCR2-EV-H-FOG-DRIFT", false);
  await writeMotionReceipt("HP-OWCR2-EV-D-LANTERN-NEUTRAL", {
    transformOrigin: await lantern.evaluate((node) => getComputedStyle(node).transformOrigin),
    rotations: samples,
    starOpacity,
    fogAnimationName: await fog.evaluate((node) => getComputedStyle(node).animationName),
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".star-field i").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator(".distant-clouds")).toHaveCSS("animation-name", "none");
  const reducedLantern = page.locator(".hanging-lantern");
  const reducedFirst = await reducedLantern.getAttribute("style");
  await page.waitForTimeout(600);
  expect(await reducedLantern.getAttribute("style")).toBe(reducedFirst);
  await capture(page, "HP-OWCR2-EV-AB-REDUCED-MOTION", false);
});

test("Journey F: Dark theme restoration", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await setTheme(page, "DARK");
  await page.goto("/");
  const explainer = page.locator(".gateway-explainer");
  await expect(explainer.getByRole("heading", { name: "What is a Chronicle?" })).toBeVisible();
  const luminance = await backgroundLuminance(explainer, "--surface-default");
  expect(luminance).toBeLessThan(0.2);
  await capture(page, "HP-OWCR2-EV-I-DARK-WHAT-IS-A-CHRONICLE");
  await page.goto("/community");
  expect(await backgroundLuminance(page.locator(".community-harbor"), "--background-primary")).toBeLessThan(0.2);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
});

test("Journey G: Light Mode", async ({ context, page }) => {
  const account = await signIn(page, "SERA");
  await accountDestination(page, account, "Preferences");
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("LIGHT");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await capture(page, "HP-OWCR2-EV-J-LIGHT-GATEWAY");
  await page.goto("/tales");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("heading", { name: "Chronicle preview" })).toBeVisible();
  await page.goto("/community");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  expect(await backgroundLuminance(page.locator(".community-harbor"), "--background-primary")).toBeGreaterThan(0.65);
  await capture(page, "HP-OWCR2-EV-K-LIGHT-COMMUNITY");
  await accountDestination(page, account, "Personal Harbor");
  const secondary = page.locator(".personal-harbor__hero p:not(.personal-harbor__eyebrow)").first();
  expect(await contrastRatio(secondary)).toBeGreaterThanOrEqual(4.5);
  await capture(page, "HP-OWCR2-EV-L-LIGHT-PERSONAL-HARBOR");
  await page.goto("/passport");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await second.close();
});

test("Journey A: Sera workspace truth", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await accountDestination(page, account, "All Workspaces");
  for (const workspace of ["Player", "Captain", "Creator"]) {
    await settledLink(page, page.getByRole("link", { name: `Enter ${workspace}` }).filter({ visible: true }).first());
    await expect(page.getByText(/Permission required|Access denied/u)).toHaveCount(0);
    await accountDestination(page, account, "All Workspaces");
  }
  await expect(page.getByText("Captain and Creator transitions are paused")).toHaveCount(0);
  expect(
    await db.playthroughMembership.count({
      where: { player: { accountId: account.accountId }, status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER"] } },
    }),
  ).toBe(0);
  await capture(page, "HP-OWCR2-EV-M-SERA-WORKSPACES");
});

test("Journey B: Active Chronicle lock regression", async ({ context, page }) => {
  const account = await signIn(page, "ACTIVE_CHRONICLE_PLAYER");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Captain" }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Enter Creator" }).filter({ visible: true })).toHaveCount(0);
  const second = await context.newPage();
  await second.goto("/account/roles");
  await expect(second.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
  await page.getByLabel(/Type LEAVE ACTIVE CHRONICLES/u).fill("LEAVE ACTIVE CHRONICLES");
  await page.getByRole("button", { name: "Safely leave active Chronicles" }).click();
  await expect(page.getByRole("link", { name: "Enter Captain" }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Creator" }).filter({ visible: true }).first()).toBeVisible();
  await second.reload();
  await expect(second.getByRole("link", { name: "Enter Captain" }).filter({ visible: true }).first()).toBeVisible();
  await second.close();
});

test("Journey H: Community district fast success", async ({ page }) => {
  await begin(page);
  await page.goto("/community");
  const districtLabels = await page
    .getByRole("navigation", { name: "Community Harbor districts" })
    .getByRole("link")
    .allTextContents();
  for (const label of districtLabels) {
    await settledLink(
      page,
      page.getByRole("navigation", { name: "Community Harbor districts" }).getByRole("link", { name: label }),
    );
    await expect(page.locator(".ui-loading-state")).toHaveCount(0);
    await expect(page.locator(".community-state--error")).toHaveCount(0);
    await expect(page.getByText("Current Area", { exact: true })).toHaveCount(0);
  }
  await capture(page, "HP-OWCR2-EV-N-COMMUNITY-FAST-READY");
});

test("Journey I: Community district slow success", async ({ page }) => {
  await begin(page);
  await page.goto("/community/chronicles");
  let release!: () => void;
  let intercepted!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const requestIntercepted = new Promise<void>((resolve) => (intercepted = resolve));
  await page.route("**/api/community/discover?**", async (route) => {
    intercepted();
    await gate;
    await route.continue();
  });
  const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
  await search.fill("coast");
  const navigation = search.press("Enter");
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

test("Journey J: Community real failure", async ({ page }) => {
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
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

test("Journey K: Public Profile identity for review", async ({ page }) => {
  await signIn(page, "REVIEW_ELIGIBLE");
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("form", { name: "Write a review" })).toBeVisible();
  await expect(page.getByText(/Community Profile/u)).toHaveCount(0);
  await capture(page, "HP-OWCR2-EV-Q-PUBLIC-PROFILE-REVIEW");
  await page.getByRole("combobox", { name: /Rating/u }).selectOption("5");
  await page.getByLabel("Preview-safe review").fill("Public Profile identity accepted for this Round 2 review.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Your review was saved.")).toBeVisible();
});

test("Journey L: Missing public Profile setup", async ({ page }) => {
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
  await settledLink(page, page.getByRole("link", { name: "Set up public Profile" }));
  const profileForm = page.locator("main:visible").last().locator("form.harbor-form");
  const handle = profileForm.getByRole("textbox", { name: /^Handle/u });
  const visibility = profileForm.getByLabel("Default visibility");
  await expect(handle).toBeVisible();
  await handle.fill("review-eligible-return");
  await visibility.selectOption("PUBLIC");
  await expect(handle).toHaveValue("review-eligible-return");
  await expect(visibility).toHaveValue("PUBLIC");
  await profileForm.getByRole("button", { name: "Save Profile" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${escapeRegex(new URL(detail, "http://local").pathname)}#community-review-composer$`, "u"),
  );
  await expect(page.getByRole("form", { name: "Write a review" })).toBeVisible();
  await page.getByRole("combobox", { name: /Rating/u }).selectOption("4");
  await page.getByLabel("Preview-safe review").fill("Profile setup returned to the intended Chronicle context.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Your review was saved.")).toBeVisible();
});

test("Journey M: Save count", async ({ page }) => {
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
  await page.reload();
  const reloadedCard = page
    .locator(".community-card")
    .filter({ has: page.getByRole("heading", { name: listing.title }) })
    .first();
  await expect(reloadedCard.getByText(`${before + 1} saves`, { exact: false })).toBeVisible();
  await reloadedCard.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(reloadedCard.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect
    .poll(() => db.communitySave.count({ where: { subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" } }))
    .toBe(before);
});

test("Journey N: Rating aggregation", async ({ page }) => {
  await signIn(page, "REVIEW_EMPTY");
  const listing = await reviewListing();
  const initial = await eligibleReviewSummary(listing.id);
  await page.goto(`/community/${encodeURIComponent(listing.slug)}`);
  await page.getByRole("combobox", { name: /Rating/u }).selectOption("5");
  await page.getByLabel("Preview-safe review").fill("Round 2 aggregate create evidence.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect.poll(async () => (await eligibleReviewSummary(listing.id)).count).toBe(initial.count + 1);
  await page.getByRole("button", { name: "Edit my review" }).click();
  await page
    .getByRole("heading", { name: "Edit your review" })
    .locator("..")
    .getByRole("combobox", { name: /Rating/u })
    .selectOption("2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your review changes were saved.")).toBeVisible();
  expect((await eligibleReviewSummary(listing.id)).average).not.toBe(initial.average);
  await capture(page, "HP-OWCR2-EV-T-RATING-SUMMARY");
  await page.getByRole("button", { name: "Delete my review" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect.poll(async () => (await eligibleReviewSummary(listing.id)).count).toBe(initial.count);
});

test("Journey O: Ineligible Chronicle review", async ({ page }) => {
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

test("Journey Q: Expanded Chronicle preview", async ({ page }) => {
  await begin(page);
  await page.goto("/tales");
  await expect(page.getByRole("link", { name: "Preview Chronicle" }).first()).toBeVisible();
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("heading", { name: "Chronicle preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practical requirements" })).toBeVisible();
  await expect(page.getByText(/Preview shows public, preview-safe details only/u).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Chronicle" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-V-CHRONICLE-PREVIEW-EXPANDED");
});

test("Journey P: Completed Chronicle review later", async ({ page }) => {
  await signIn(page, "REVIEW_EMPTY");
  await page.goto("/passport/history");
  await expect(page.getByRole("link", { name: "Review Chronicle" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-W-PASSPORT-REVIEW-ENTRY");
  await settledLink(page, page.getByRole("link", { name: "Review Chronicle" }).first());
  const reviewForm = page.getByRole("form", { name: "Write a review" }).filter({ visible: true }).last();
  await expect(reviewForm).toBeVisible();
  await reviewForm.getByRole("combobox", { name: /Rating/u }).selectOption("5");
  const reviewBody = reviewForm.getByLabel("Preview-safe review");
  await reviewBody.fill("A verified-completion review submitted from Passport history.");
  await expect(reviewBody).toHaveValue("A verified-completion review submitted from Passport history.");
  await reviewForm.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("A verified-completion review submitted from Passport history.")).toBeVisible();
});

test("Journey S: Text contrast", async ({ page }) => {
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
  await setTheme(page, "DARK");
  for (const route of ["/account", "/account/profile", "/community", "/passport"]) {
    await page.goto(route);
    const body = page.locator("main:visible").last().locator("p").first();
    if (await body.isVisible()) expect(await contrastRatio(body)).toBeGreaterThanOrEqual(4.5);
  }
  await page.goto("/community");
  await capture(page, "HP-OWCR2-EV-Y-COMMUNITY-CONTRAST");
});

test("Journey R: Synthetic email walkthrough", async ({ page }) => {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Create Account", exact: true }));
  const email = `round2-registered-${Date.now()}@owner-correction.example.test`;
  await page.getByLabel("Display name").fill("Round 2 Email Walkthrough");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(handoff.password);
  await page.getByLabel("Confirm password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  const verification = await waitForDelivery("VERIFY_EMAIL", email);
  await page.goto(`/verify-email?token=${encodeURIComponent(verification.token!)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/account/personal-information");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const text = await page.getByRole("main").last().innerText();
  expect(text).not.toMatch(/synthetic outbox|email simulator|test delivery|provider simulator/iu);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  const recovery = await waitForDelivery("PASSWORD_RESET", email);
  await page.goto(`/reset-password?token=${encodeURIComponent(recovery.token!)}`);
  await page.getByLabel("Password", { exact: true }).fill(`${handoff.password}R`);
  await page.getByLabel("Confirm password").fill(`${handoff.password}R`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Round 2 Email Walkthrough" })).toBeVisible();
});

test("Journey T: Experience Images generation", async ({ page }) => {
  const manifestPath = path.join(path.resolve(process.cwd()), "Experience_Images", "manifest.json");
  const indexPath = path.join(path.resolve(process.cwd()), "Experience_Images", "index.html");
  expect(existsSync(manifestPath)).toBe(true);
  expect(existsSync(indexPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    sourceSha: string;
    records: Array<{ screenshotPath: string; sha256: string; visualReviewStatus: string }>;
    routeCensus: { humanFacingRoutes: number; capturedHumanFacingRoutes: number };
    visualReviewStatus: string;
  };
  expect(manifest.sourceSha).toMatch(/^[0-9a-f]{40}$/u);
  expect(manifest.records).toHaveLength(227);
  expect(manifest.routeCensus.humanFacingRoutes).toBe(88);
  expect(manifest.routeCensus.capturedHumanFacingRoutes).toBe(88);
  for (const record of manifest.records) {
    const imagePath = path.join(path.resolve(process.cwd()), "Experience_Images", record.screenshotPath);
    expect(existsSync(imagePath)).toBe(true);
    expect(createHash("sha256").update(readFileSync(imagePath)).digest("hex")).toBe(record.sha256);
    expect(record.visualReviewStatus).toBe("ACCEPTED");
  }
  expect(manifest.visualReviewStatus).toBe("ACCEPTED");
  for (const contactSheet of ["Master_Desktop.png", "Master_Mobile.png", "Master_Light_Mode.png", "Master_Dark_Mode.png"])
    expect(existsSync(path.join(path.resolve(process.cwd()), "Experience_Images", "Contact_Sheets", contactSheet))).toBe(true);
  await begin(page);
});

test("Journey U: Round 2 full regression", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await setTheme(page, "LIGHT");
  await accountDestination(page, account, "All Workspaces");
  await page.goto("/tales");
  await expect(page.getByRole("link", { name: "Preview Chronicle" }).first()).toBeVisible();
  await page.goto(await reviewListingUrl());
  await expect(page.getByRole("heading", { name: "Chronicle preview" })).toBeVisible();
  await page.goto("/community");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto("/passport/history");
  await expect(page.getByRole("heading", { name: "Chronicle History" })).toBeVisible();
  const disclosure = await accountMenu(page, account.displayName);
  await disclosure.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  await capture(page, "HP-OWCR2-EV-AE-FULL-ROUND2-REGRESSION");
});

test("Journey V: Mobile correction sweep", async ({ page }) => {
  const account = await signIn(page, "SERA");
  await setTheme(page, "LIGHT");
  await accountDestination(page, account, "All Workspaces");
  await page.goto("/community");
  await capture(page, "HP-OWCR2-EV-Z-MOBILE-COMMUNITY");
  await page.goto("/account/profile");
  await capture(page, "HP-OWCR2-EV-AA-MOBILE-PROFILE-SETUP");
  await page.goto("/account");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
  const disclosure = await accountMenu(page, account.displayName);
  await disclosure.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
});

test("Journey W: Original regression", async ({ page }) => {
  const receiptPath = path.join(taskRoot, "reports", "owner-correction-round2-journeys", "journey-W-regressions.json");
  expect(existsSync(receiptPath)).toBe(true);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
    sourceSha: string;
    correctionRound1: string;
    originalPhase7: string;
  };
  expect(receipt.sourceSha).toBe(sourceSha);
  expect(receipt.correctionRound1).toBe("PASSED_A_U");
  expect(receipt.originalPhase7).toBe("PASSED_A_O");
  await begin(page);
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

async function eligibleReviewSummary(listingId: string) {
  const reviews = await db.communityReview.findMany({
    where: { listingId, status: "ACTIVE", deletedAt: null, verifiedCompletion: true },
    select: { rating: true },
  });
  return {
    count: reviews.length,
    average: reviews.length === 0 ? 0 : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
  };
}

async function waitForDelivery(purpose: string, email: string) {
  let delivery: Delivery | undefined;
  await expect
    .poll(
      () => {
        if (!existsSync(outboxPath)) return null;
        delivery = readFileSync(outboxPath, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Delivery)
          .find((row) => row.purpose === purpose && row.email === email.toLowerCase());
        return delivery?.token ?? delivery?.detail ?? null;
      },
      { timeout: 20_000, message: `${purpose} delivery for ${email}` },
    )
    .not.toBeNull();
  return delivery!;
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

async function captureAtRotation(
  page: Page,
  lantern: Locator,
  evidenceId: string,
  matches: (rotation: number) => boolean,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = await rotation(lantern);
    if (matches(value)) {
      await capture(page, evidenceId, false);
      return value;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`${evidenceId} rotation threshold was not observed.`);
}

async function writeMotionReceipt(evidenceId: string, measurements: Record<string, unknown>) {
  const reportRoot = path.join(taskRoot, "reports", "owner-correction-round2-journeys");
  await mkdir(reportRoot, { recursive: true });
  await writeFile(
    path.join(reportRoot, `${evidenceId}-motion.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion: "homeport-phase7-owner-correction-round2-v1",
        databasePath,
        measurementKind: "COMPUTED_FRAME_SEQUENCE",
        measurements,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
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

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = {
  accountId: string | null;
  username: string | null;
  email: string | null;
  displayName: string;
  sessionToken?: string;
};
type Delivery = { purpose: string; email: string; token?: string; accountId: string; detail?: string };

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH"));
const outboxPath = path.join(taskRoot, "synthetic-outbox", `journey-${journeyId}.jsonl`);
const credentialHandoff = JSON.parse(
  readFileSync(path.join(taskRoot, "credentials", "owner-correction-walkthrough-credentials.private.json"), "utf8"),
) as { password: string; accounts: Record<string, Alias> };
const correctionTokens = JSON.parse(
  readFileSync(path.join(taskRoot, "tokens", "owner-correction-tokens.private.json"), "utf8"),
) as { pendingVerification: string; pendingEmailChange: string; guestSession: string };
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  rmSync(outboxPath, { force: true });
  await page.emulateMedia({ reducedMotion: journeyId === "S" ? "no-preference" : "reduce" });
});
test.afterAll(async () => db.$disconnect());

test("Journey A: Chronicle preview", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await globalDestination(page, "Explore Chronicles");
  const sessionsBefore = await db.taleSession.count();
  await settledLink(page, page.getByRole("link", { name: "Preview Chronicle" }).first());
  await expect(page.getByText("Chronicle preview", { exact: true })).toBeVisible();
  await expect(page.getByText(/has not created a session, Crew, invitation, or participant/u)).toBeVisible();
  expect(await db.taleSession.count()).toBe(sessionsBefore);
  await capture(page, "HP-OWCR1-EV-A-CHRONICLE-PREVIEW");

  await settledLink(page, page.getByRole("link", { name: "Start Chronicle", exact: true }));
  const playerName = page.getByLabel("Player name for this Chronicle");
  await expect(playerName).toHaveValue(account.displayName);
  await expect(playerName).toHaveAttribute("readonly", "");
  await capture(page, "HP-OWCR1-EV-B-SIGNED-IN-NAME");
  await page.getByRole("button", { name: "Edit for this Chronicle" }).click();
  await expect(playerName).not.toHaveAttribute("readonly", "");
  await playerName.fill("Lantern Alias Test");
  expect((await playerName.boundingBox())?.width).toBeGreaterThanOrEqual(160);
  await capture(page, "HP-OWCR1-EV-C-CHRONICLE-ALIAS-EDIT");
  await page.getByRole("button", { name: "Begin Voyage" }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+\/session\/[^/]+$/u);
  const profile = await db.playerProfile.findUnique({ where: { accountId: account.accountId! } });
  expect(profile?.displayName).toBe(account.displayName);
  const alias = await db.playthroughMembership.findFirst({
    where: { playerProfileId: profile!.id, participationAlias: "Lantern Alias Test" },
  });
  expect(alias?.participationAlias).toBe("Lantern Alias Test");
});

test("Journey B: Anonymous Chronicle start", async ({ page }) => {
  await begin(page);
  await globalDestination(page, "Explore Chronicles");
  await settledLink(page, page.getByRole("link", { name: "Preview Chronicle" }).first());
  await settledLink(page, page.getByRole("link", { name: "Start Chronicle", exact: true }));
  const guestName = page.getByLabel("Guest player name");
  await expect(guestName).toBeEditable();
  await guestName.fill("Anonymous Harbor Guest");
  await page.getByRole("button", { name: "Begin Voyage" }).click();
  await expect(page).toHaveURL(/\/play\/[^/]+\/session\/[^/]+$/u);
  const anonymousSession = await db.taleSession.findFirst({ where: { ownerLabel: "Anonymous Harbor Guest" } });
  expect(anonymousSession).toBeTruthy();
  const menu = await accountMenu(page, "Account");
  await expect(menu.getByRole("link", { name: "Create Account", exact: true })).toBeVisible();
});

test("Journey C: All Workspaces", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  for (const workspace of ["Player", "Captain", "Creator"]) {
    const card = page.getByRole("heading", { name: workspace, exact: true }).locator("..");
    await expect(card.getByRole("link", { name: `Enter ${workspace}` })).toBeVisible();
  }
  await capture(page, "HP-OWCR1-EV-D-ALL-WORKSPACES");
  for (const destination of ["Player", "Captain", "Creator"]) {
    await page.getByRole("link", { name: `Enter ${destination}` }).click();
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto("/account/roles");
  }
});

test("Journey D: Active Chronicle lock", async ({ context, page }) => {
  const account = await signIn(page, "ACTIVE_CHRONICLE_PLAYER");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Captain" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Enter Creator" })).toHaveCount(0);
  await capture(page, "HP-OWCR1-EV-E-ACTIVE-CHRONICLE-LOCK");

  const second = await context.newPage();
  await second.goto("/account/roles");
  await expect(second.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
  await page.getByLabel(/Type LEAVE ACTIVE CHRONICLES/u).fill("LEAVE ACTIVE CHRONICLES");
  await page.getByRole("button", { name: "Safely leave active Chronicles" }).click();
  await expect(page.getByRole("link", { name: "Enter Captain" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Creator" })).toBeVisible();
  await second.bringToFront();
  await expect(second.getByRole("link", { name: "Enter Captain" })).toBeVisible();
  expect(
    await db.playthroughMembership.count({
      where: { player: { accountId: account.accountId! }, status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER"] } },
    }),
  ).toBe(0);
});

test("Journey E: View My Profile", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "View My Profile");
  await expect(page).toHaveURL(/\/profile\/hp7c-full-capability$/u);
  await expect(page.getByRole("heading", { name: account.displayName })).toBeVisible();
  await expect(page.getByText("Owner preview", { exact: true })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-F-PUBLIC-PROFILE-DESTINATION");
  await settledLink(page, page.getByRole("link", { name: "Edit Profile" }));
  await expect(page.getByRole("heading", { name: "Public Profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Personal Information" }).first()).toBeVisible();
  await expect(page.getByText("Choose avatar image", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose banner image", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Avatar image", { exact: true })).toHaveCSS("position", "absolute");
  await expect(page.getByLabel("Banner image", { exact: true })).toHaveCSS("position", "absolute");
  await capture(page, "HP-OWCR1-EV-P-PUBLIC-PROFILE-EDITOR");
  await page.goto("/account/profile/view");
  await expect(page).toHaveURL(/\/profile\/hp7c-full-capability$/u);
});

test("Journey F: Claim account", async ({ context, page }) => {
  const guest = credentialHandoff.accounts.UNCLAIMED_GUEST;
  await installSessionCookie(context, guest.sessionToken!);
  await page.goto("/account/personal-information");
  await expect(page.getByText("Account setup required", { exact: true })).toBeVisible();
  await page.goto("/account/claim");
  await expect(page.getByRole("heading", { name: "Claim your guest voyage" })).toBeVisible();
  const email = "claimed-guest@owner-correction.example.test";
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(credentialHandoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/passport/u);
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await page.goto(`/verify-email?token=${encodeURIComponent(delivery.token!)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/verified|active/u).first()).toBeVisible();
  const account = await db.userAccount.findUnique({ where: { id: guest.accountId! } });
  expect(account?.status).toBe("ACTIVE");
  await capture(page, "HP-OWCR1-EV-G-ACCOUNT-CLAIMED");
});

test("Journey G: Email registration and verification", async ({ page }) => {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Create Account", exact: true }));
  const email = `registered-${Date.now()}@owner-correction.example.test`;
  await page.getByLabel("Display name").fill("Verified Registration Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credentialHandoff.password);
  await page.getByLabel("Confirm password").fill(credentialHandoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await page.goto(`/verify-email?token=${encodeURIComponent(delivery.token!)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/account/personal-information");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-H-VERIFIED-EMAIL");
});

test("Journey H: Email change and recovery", async ({ page }) => {
  const account = await signIn(page, "PENDING_EMAIL_CHANGE");
  await accountDestination(page, account, "Personal Information");
  const nextEmail = `changed-${Date.now()}@owner-correction.example.test`;
  await page.getByLabel("New email").fill(nextEmail);
  await page.getByLabel("Current password").fill(credentialHandoff.password);
  await page.getByRole("button", { name: "Send verification" }).click();
  const change = await waitForDelivery("EMAIL_CHANGE", nextEmail);
  await page.goto(`/account/email-change?token=${encodeURIComponent(change.token!)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/confirmed|changed/u).first()).toBeVisible();
  const oldNotice = await waitForDelivery("EMAIL_CHANGE_NOTICE", account.email!);
  expect(oldNotice.detail).toContain("account recovery");
  await capture(page, "HP-OWCR1-EV-I-EMAIL-CHANGE");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(nextEmail);
  await page.getByRole("button", { name: "Continue" }).click();
  const recovery = await waitForDelivery("PASSWORD_RESET", nextEmail);
  const newPassword = `${credentialHandoff.password}R`;
  await page.goto(`/reset-password?token=${encodeURIComponent(recovery.token!)}`);
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
});

test("Journey I: Linked identities", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "Linked Identities");
  for (const label of ["Discord Correction Test", "Steam Correction Test", "Microsoft Correction Test"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  const wire = await page.locator("main").innerText();
  expect(wire).not.toMatch(/synthetic-discord-owcr1|76561198000000071|synthetic-microsoft-owcr1|collision-subject/iu);
  await capture(page, "HP-OWCR1-EV-J-LINKED-IDENTITIES");
  const steamRow = page.getByText("Steam Correction Test", { exact: true }).locator("../..");
  await steamRow.getByRole("button", { name: /Unlink/u }).click();
  await page.getByLabel("Current password").fill(credentialHandoff.password);
  await page.getByRole("button", { name: "Unlink identity" }).click();
  await expect(page.getByText("Identity unlinked.")).toBeVisible();
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
});

test("Journey J: Export", async ({ page }) => {
  const account = await signIn(page, "EXPORT_READY");
  await accountDestination(page, account, "Data & Account");
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  const downloadLink = page.getByRole("link", { name: "Download JSON" });
  await expect(downloadLink).toBeVisible();
  await capture(page, "HP-OWCR1-EV-K-DATA-EXPORT");
  const downloadUrl = await downloadLink.getAttribute("href");
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url!, { credentials: "same-origin" });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, downloadUrl);
  const body = result.body;
  expect(result.ok, `${result.status} ${body}`).toBe(true);
  expect(body).toContain('"schemaVersion":1');
  expect(body).not.toMatch(/passwordHash|csrfToken|encryptedToken|providerAccountId/iu);
});

test("Journey K: Deactivate and reactivate", async ({ browser, page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "Data & Account");
  await expect(page.getByRole("heading", { name: "Deactivate account" })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-L-DEACTIVATION-WARNING");
  const deactivate = page.getByRole("heading", { name: "Deactivate account" }).locator("..");
  await deactivate.getByLabel("Current password").fill(credentialHandoff.password);
  await deactivate.getByLabel("Type DEACTIVATE").fill("DEACTIVATE");
  await deactivate.getByRole("button", { name: "Deactivate account" }).click();
  await expect(page).toHaveURL(/\/account\/reactivate/u);
  const anonymousContext = await browser.newContext();
  const anonymous = await anonymousContext.newPage();
  await anonymous.goto("/profile/hp7c-full-capability");
  await expect(anonymous.getByRole("heading", { name: /not found|404/u })).toBeVisible();
  await anonymousContext.close();
  await page.getByLabel("Email").fill(account.email!);
  await page.getByLabel("Password").fill(credentialHandoff.password);
  await page.getByRole("button", { name: "Reactivate account" }).click();
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
});

test("Journey L: Delete request and cancel", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "Data & Account");
  const deletion = page.getByRole("heading", { name: "Delete account" }).locator("..");
  await expect(deletion.getByText(/Create and download a private export above first/u)).toBeVisible();
  await capture(page, "HP-OWCR1-EV-M-DELETION-DANGER");
  await deletion.getByLabel("Current password").fill(credentialHandoff.password);
  await deletion.getByLabel("Type DELETE ACCOUNT").fill("DELETE ACCOUNT");
  await deletion.getByRole("button", { name: "Schedule account deletion" }).click();
  await expect(page).toHaveURL(/\/account\/cancel-deletion/u);
  await page.getByLabel("Email").fill(account.email!);
  await page.getByLabel("Password").fill(credentialHandoff.password);
  await page.getByLabel("Type CANCEL DELETION").fill("CANCEL DELETION");
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page).toHaveURL(/\/account$/u);
  expect((await db.userAccount.findUnique({ where: { id: account.accountId! } }))?.status).toBe("ACTIVE");
});

test("Journey M: Personal Harbor corrections", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "Personal Harbor");
  const navigation = page.getByRole("navigation", { name: "Personal Harbor sections" });
  for (const label of [
    "Overview",
    "Personal Information",
    "Public Profile",
    "Preferences",
    "Linked Identities",
    "Data & Account",
  ])
    await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Contextual navigation" })).toHaveCount(0);
  const signOut = navigation.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();
  await capture(page, "HP-OWCR1-EV-N-PERSONAL-HARBOR-NAV");
  await signOut.scrollIntoViewIfNeeded();
  await capture(page, "HP-OWCR1-EV-O-SIGN-OUT-ENTRY", { fullPage: false, scrollToTop: false });
});

test("Journey N: Preference effects", async ({ context, page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "Preferences");
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("DARK");
  await page.getByRole("combobox", { name: "Motion", exact: true }).selectOption("GENTLE");
  await page.getByRole("slider").fill("1.4");
  await page.getByRole("combobox", { name: "Contrast", exact: true }).selectOption("HIGH");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-voyage-contrast", "high");
  await expect(page.locator("html")).toHaveAttribute("data-motion-preference", "gentle");
  await expect(page.locator("html")).toHaveCSS("--account-text-scale", "1.4");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "dark");

  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("LIGHT");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(second.locator("html")).toHaveAttribute("data-voyage-theme", "light");

  await page.route("**/api/passport/preferences", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic failure" }),
      });
    else await route.continue();
  });
  await page.getByRole("combobox", { name: "Contrast", exact: true }).selectOption("STANDARD");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Synthetic failure|could not/u })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-AE-CORRECTION-FULL-REGRESSION");
});

test("Journey O: Fast and slow loading", async ({ page }) => {
  await begin(page);
  await page.evaluate(() => {
    (window as unknown as { homeportLoadingSeen: boolean }).homeportLoadingSeen = false;
    new MutationObserver(() => {
      if (document.querySelector(".ui-loading-state"))
        (window as unknown as { homeportLoadingSeen: boolean }).homeportLoadingSeen = true;
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { homeportLoadingSeen: boolean }).homeportLoadingSeen)).toBe(
    false,
  );
  await capture(page, "HP-OWCR1-EV-Q-FAST-NO-LOADING-FLASH");

  let releaseRequest!: () => void;
  let markIntercepted!: () => void;
  const requestRelease = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  const requestIntercepted = new Promise<void>((resolve) => {
    markIntercepted = resolve;
  });
  await page.route("**/api/tales**", async (route) => {
    markIntercepted();
    await requestRelease;
    await route.continue();
  });
  const navigation = page.goto("/tales", { waitUntil: "domcontentloaded" });
  await requestIntercepted;
  await page.waitForTimeout(550);
  await expect(page.locator(".ui-loading-state")).toBeVisible({ timeout: 2_000 });
  await capture(page, "HP-OWCR1-EV-R-DELAYED-LOADING");
  await page.waitForTimeout(200);
  releaseRequest();
  await navigation;
  await expect(page).toHaveURL(/\/tales/u);
  await expect(page.locator(".ui-loading-state")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Preview Chronicle" }).first()).toBeVisible();
});

test("Journey P: Community compact search", async ({ page }) => {
  await begin(page);
  await globalDestination(page, "Community Harbor");
  const search = page.getByRole("search");
  const query = search.getByRole("searchbox", { name: "Search public Community Harbor" });
  await expect(query).toBeVisible();
  await capture(page, "HP-OWCR1-EV-U-COMMUNITY-COMPACT-SEARCH");
  await query.fill("Clockwork");
  await query.press("Enter");
  await expect(page).toHaveURL(/q=Clockwork/u);
  await page.getByRole("button", { name: "Clear search and filters" }).first().click();
  await expect(page).not.toHaveURL(/q=/u);
  await search.getByRole("button", { name: "Full Search" }).click();
  await expect(search.getByRole("button", { name: "Close Full Search" })).toHaveAttribute("aria-expanded", "true");
  await expect(search.getByRole("group", { name: "Content type" })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-V-COMMUNITY-FULL-SEARCH");
  await search.getByRole("button", { name: "Close Full Search" }).click();
  await expect(search.getByRole("button", { name: "Full Search" })).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  await page.goForward();
  await expect(query).toBeVisible();
});

test("Journey Q: Community reviews", async ({ page }) => {
  const account = await signIn(page, "REVIEW_EMPTY");
  const reviewedListingIds = (
    await db.communityReview.findMany({ where: { status: "ACTIVE" }, select: { listingId: true } })
  ).map((review) => review.listingId);
  const listing = await db.communityListing.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      moderationStatus: "ACTIVE",
      archivedAt: null,
      removedAt: null,
      currentReleaseId: { not: null },
      id: { notIn: reviewedListingIds },
      owner: { visibility: "COMMUNITY", moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
    },
    orderBy: { id: "asc" },
  });
  expect(listing).toBeTruthy();
  await page.goto(`/community/${listing!.slug}`);
  await expect(page.getByRole("heading", { name: "Community reviews" })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-W-COMMUNITY-REVIEW-COMPOSER");
  await page.getByLabel(/Rating/u).selectOption("4");
  await page.getByLabel("Preview-safe review").fill("A responsive synthetic review for the correction journey.");
  await page.getByLabel(/Include spoiler details/u).check();
  await page
    .getByRole("textbox", { name: /^Spoiler details/u })
    .fill("Synthetic spoiler detail remains behind an explicit reveal.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Your review was saved.")).toBeVisible();
  await expect(page.getByText("A responsive synthetic review for the correction journey.")).toBeVisible();
  await capture(page, "HP-OWCR1-EV-X-COMMUNITY-REVIEW-LIST");
  await page.getByRole("button", { name: "Edit my review" }).click();
  await page
    .getByRole("heading", { name: "Edit your review" })
    .locator("..")
    .getByLabel("Preview-safe review")
    .fill("An edited responsive synthetic review for the correction journey.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your review changes were saved.")).toBeVisible();
  await page.getByRole("button", { name: "Delete my review" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("No public reviews yet.")).toBeVisible();
});

test("Journey R: Account dropdown motion", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  const trigger = page.getByRole("button", { name: account.displayName });
  await trigger.click();
  const disclosure = page.locator("#shell-account-disclosure");
  await expect(disclosure).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await capture(page, "HP-OWCR1-EV-T-ACCOUNT-MENU-MOTION");
  await page.keyboard.press("Escape");
  await expect(disclosure).toHaveCount(0);
  await trigger.click();
  await settledLink(page, disclosure.getByRole("link", { name: "All Workspaces" }));
  await expect(page.locator('[data-route-layer="/account/roles"]')).toBeVisible();
  await expect(page.locator(".product-route-layer")).toHaveCount(1);
  await capture(page, "HP-OWCR1-EV-S-PAGE-TRANSITION");
});

test("Journey S: Home ambient motion", async ({ page }) => {
  await begin(page);
  const roles = await page.locator("[data-role-object]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  );
  for (let first = 0; first < roles.length; first += 1)
    for (let second = first + 1; second < roles.length; second += 1)
      expect(
        roles[first].right <= roles[second].left ||
          roles[second].right <= roles[first].left ||
          roles[first].bottom <= roles[second].top ||
          roles[second].bottom <= roles[first].top,
      ).toBe(true);
  await expect(page.locator(".harbor-landing")).toHaveAttribute("data-ambient-state", "active");
  await expect(page.locator(".hanging-lantern")).toBeVisible();
  await expect(page.locator(".star-field i").first()).toHaveCSS("animation-name", "harbor-star-twinkle");
  await capture(page, "HP-OWCR1-EV-Y-HOME-FIRST-PAINT");
  await capture(page, "HP-OWCR1-EV-Z-HOME-AMBIENT-MOTION");
  await page.waitForTimeout(900);
  await captureFrame(page, "HP-OWCR1-EV-Z-HOME-AMBIENT-MOTION-frame-2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".harbor-landing")).toHaveAttribute("data-ambient-state", "paused");
  await capture(page, "HP-OWCR1-EV-AA-REDUCED-MOTION");
});

test("Journey T: Full correction regression", async ({ page }) => {
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "All Workspaces");
  await page.getByRole("link", { name: "Enter Player" }).click();
  await globalDestination(page, "Explore Chronicles");
  await settledLink(page, page.getByRole("link", { name: "Preview Chronicle" }).first());
  await settledLink(page, page.getByRole("link", { name: "Start Chronicle" }));
  await expect(page.getByLabel("Player name for this Chronicle")).toHaveValue(account.displayName);
  await page.goto("/account/roles");
  await page.getByRole("link", { name: "Enter Creator" }).click();
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  await accountDestination(page, account, "Personal Harbor");
  await expect(page.getByRole("navigation", { name: "Personal Harbor sections" })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-AE-CORRECTION-FULL-REGRESSION");
  await page
    .getByRole("navigation", { name: "Personal Harbor sections" })
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(page.getByRole("button", { name: /^(Account|Session ended)$/u })).toBeVisible();
});

test("Journey U: Mobile owner correction sweep", async ({ page }) => {
  await begin(page);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  const account = await signIn(page, "FULL_CAPABILITY");
  await accountDestination(page, account, "All Workspaces");
  await capture(page, "HP-OWCR1-EV-AB-MOBILE-WORKSPACES");
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
  await page.getByRole("button", { name: "Full Search" }).click();
  await capture(page, "HP-OWCR1-EV-AC-MOBILE-HARBOR-SEARCH");
  await accountDestination(page, account, "View My Profile");
  await accountDestination(page, account, "Personal Harbor");
  const mobileSections = page.locator("details.personal-harbor__mobile-sections");
  await mobileSections.locator("summary").click();
  await expect(mobileSections.getByRole("button", { name: "Sign out" })).toBeVisible();
  await capture(page, "HP-OWCR1-EV-AD-MOBILE-PERSONAL-HARBOR");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

async function begin(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole("main")).toBeVisible();
}

async function signIn(page: Page, alias: string, password = credentialHandoff.password) {
  const account = credentialHandoff.accounts[alias];
  if (!account) throw new Error(`Unknown owner-correction alias: ${alias}`);
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Sign In", exact: true }));
  await page.getByLabel("Email or legacy Player name").fill(account.email ?? account.username!);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  return account;
}

async function installSessionCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: "wayfarer_account",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

async function accountMenu(page: Page, label: string) {
  const button =
    label === "Account"
      ? page.getByRole("button", { name: /^(Account|Session ended)$/u })
      : page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  const disclosure = page.locator("#shell-account-disclosure");
  await expect(disclosure).toBeVisible();
  return disclosure;
}

async function accountDestination(page: Page, account: Alias, label: string) {
  const menu = await accountMenu(page, account.displayName);
  let link = menu.getByRole("link", { name: label, exact: true });
  if (label === "View My Profile") {
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/profile\/[^/]+$/u);
    await expect(page.getByRole("main")).toBeVisible();
    return;
  }
  if ((await link.count()) === 0) {
    await settledLink(page, menu.getByRole("link", { name: "Personal Harbor", exact: true }));
    link = page
      .getByRole("navigation", { name: "Personal Harbor sections" })
      .getByRole("link", { name: label, exact: true });
  }
  await settledLink(page, link);
}

async function globalDestination(page: Page, label: string) {
  const navigation = page.getByRole("navigation", { name: "Global navigation" });
  const link = navigation.getByRole("link", { name: label, exact: true });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Open navigation" }).click();
  await settledLink(page, link);
}

async function settledLink(page: Page, link: Locator) {
  await expect(link).toBeVisible();
  const destination = await link.getAttribute("href");
  if (!destination) throw new Error("The visible navigation control has no destination.");
  await link.click();
  const pathname = new URL(destination, page.url()).pathname;
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
  await expect(page.getByRole("main")).toBeVisible();
}

async function waitForDelivery(purpose: string, email: string) {
  let delivery: Delivery | undefined;
  await expect
    .poll(
      () => {
        delivery = readOutbox().find((row) => row.purpose === purpose && row.email === email.toLowerCase());
        return delivery?.token ?? delivery?.detail ?? null;
      },
      { timeout: 20_000, message: `${purpose} delivery for ${email}` },
    )
    .not.toBeNull();
  return delivery!;
}

function readOutbox(): Delivery[] {
  if (!existsSync(outboxPath)) return [];
  return readFileSync(outboxPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Delivery);
}

async function capture(page: Page, evidenceId: string, options: { fullPage?: boolean; scrollToTop?: boolean } = {}) {
  const screenshotRoot = path.join(taskRoot, "screenshots", `correction-${journeyId}`);
  const reportRoot = path.join(taskRoot, "reports", "owner-correction-journeys");
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });
  const screenshotPath = path.join(screenshotRoot, `${evidenceId}.png`);
  const intentionalMotion = ["HP-OWCR1-EV-Y-HOME-FIRST-PAINT", "HP-OWCR1-EV-Z-HOME-AMBIENT-MOTION"].includes(
    evidenceId,
  );
  await page.evaluate((scrollToTop) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (scrollToTop) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, options.scrollToTop !== false);
  if (!intentionalMotion) {
    await expect
      .poll(() =>
        page.locator(".product-route-layer").evaluateAll((layers) =>
          layers.map((layer) => {
            const style = getComputedStyle(layer);
            return { opacity: style.opacity, visibility: style.visibility };
          }),
        ),
      )
      .toEqual([{ opacity: "1", visibility: "visible" }]);
    await page.waitForTimeout(120);
  }
  const image = await page.screenshot({
    path: screenshotPath,
    fullPage: options.fullPage !== false,
    animations: intentionalMotion ? "allow" : "disabled",
    caret: "hide",
    style:
      ".product-shell-header { position: relative !important; top: auto !important; } .skip-link { display: none !important; }",
  });
  await writeFile(
    path.join(reportRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion: "homeport-phase7-owner-correction-round1-v1",
        databasePath,
        screenshotPath,
        screenshotSha256: createHash("sha256").update(image).digest("hex"),
        browser: "Playwright Chromium",
        viewport: page.viewportSize(),
        motionMode: journeyId === "S" ? "FULL_THEN_REDUCED" : "REDUCED",
        captureNormalization: intentionalMotion
          ? "Sticky shell header rendered in normal document flow; full motion preserved."
          : "Sticky shell header rendered in normal document flow; animations and caret disabled after route settlement.",
        captureExtent: options.fullPage === false ? "VIEWPORT" : "FULL_PAGE",
        route: new URL(page.url()).pathname,
        title: await page.title(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function captureFrame(page: Page, evidenceId: string) {
  const frameRoot = path.join(taskRoot, "screenshots", `correction-${journeyId}`, "motion-frames");
  await mkdir(frameRoot, { recursive: true });
  await page.screenshot({ path: path.join(frameRoot, `${evidenceId}.png`), fullPage: false });
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string | null; username: string | null; email: string | null; displayName: string };
type Delivery = { purpose: string; email: string; token?: string; accountId: string; detail?: string };
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_DATABASE_PATH"));
const outboxPath = path.join(taskRoot, "synthetic-outbox", `phase7-journey-${journeyId}.jsonl`);
const credentialHandoff = JSON.parse(
  readFileSync(path.join(taskRoot, "credentials", "walkthrough-credentials.private.json"), "utf8"),
) as { password: string; accounts: Record<string, Alias> };
const tokens = JSON.parse(readFileSync(path.join(taskRoot, "tokens", "phase7-tokens.private.json"), "utf8")) as {
  resetValid: string;
  resetExpired: string;
  verifyValid: string;
};
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  rmSync(outboxPath, { force: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test.afterAll(async () => db.$disconnect());

test(`Journey A: account creation`, async ({ page }) => {
  await begin(page);
  await keyboardMilestone(page);
  const menu = await accountMenu(page, "Account");
  await menu.getByRole("link", { name: "Create Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
  await page.getByLabel("Display name").fill("Phase 7 Registration Candidate");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("registration-candidate@phase7.example.test");
  await page.getByLabel("Password", { exact: true }).fill(credentialHandoff.password);
  await page.getByLabel("Confirm password").fill(`${credentialHandoff.password}x`);
  await page.getByLabel("Confirm password").press("Enter");
  await expect(page.getByText(/match|same/u).first()).toBeVisible();
  await page.getByLabel("Confirm password").fill(credentialHandoff.password);
  await page.getByLabel("Confirm password").press("Enter");
  const delivery = await waitForDelivery("VERIFY_EMAIL", "registration-candidate@phase7.example.test");
  await page.getByLabel("Code").fill(delivery.token!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Phase 7 Registration Candidate", exact: true })).toBeVisible();
  await page.goto("/account/profile");
  await expect(page.getByRole("button", { name: "Phase 7 Registration Candidate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Profile", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a handle to create a public Profile destination.")).toBeVisible();
  await capture(page, "registered-profile");
  const profileMenu = await accountMenu(page, "Phase 7 Registration Candidate");
  await profileMenu.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/u);
});

test(`Journey B: returning account`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator transitions are paused", exact: true })).toBeVisible();
  await accountDestination(page, account, "View My Profile");
  await expect(page.getByRole("heading", { name: account.displayName })).toBeVisible();
  await expect(page.getByText("Owner preview", { exact: true })).toBeVisible();
  await capture(page, "cross-workspace-account");
  const menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: /^(Account|Session ended)$/u })).toBeVisible();
  await page.goto("/player/library");
  await expect(page).toHaveURL(/\/sign-in/u);
});

test(`Journey C: player`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Player");
  await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
  await clickFirstRoute(page, "/player/playthroughs/");
  await expect(page.getByRole("heading", { name: "The Lantern Coast", level: 1 })).toBeVisible();
  await capture(page, "player-voyage");
  await accountDestination(page, account, "Chronicle Passport");
  await expect(page.getByRole("heading", { name: /Chronicle Passport/u }).first()).toBeVisible();
});

test(`Journey D: captain`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await leaveActiveChronicles(page, account);
  await enterWorkspaceFromOverview(page, "Captain");
  await expect(page.getByRole("heading", { name: /Captain/u }).first()).toBeVisible();
  await clickFirstRoute(page, "/captain/sessions/");
  await expect(page.getByRole("heading", { name: "The Lantern Coast", level: 1 })).toBeVisible();
  await capture(page, "captain-session");
  await accountDestination(page, account, "View My Profile");
});

test(`Journey E: creator`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await leaveActiveChronicles(page, account);
  await enterWorkspaceFromOverview(page, "Creator");
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
  const chronicle = page.locator("main a[href^='/studio/tales/']").first();
  if (await chronicle.isVisible()) await chronicle.click();
  await expect(page.getByRole("main")).toBeVisible();
  await capture(page, "creator-private-state");
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
});

test(`Journey F: community discovery`, async ({ page }) => {
  const account = await signIn(page, "PLAYER_ONLY");
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("heading", { name: "Featured at the Harbor" })).toBeVisible();
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("navigation", { name: "Community Harbor districts" }).getByRole("link", { name: "Chronicles" }),
    "Community Chronicle district",
  );
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: "Clockwork Reef Almanac" }).first(),
    "Community Chronicle detail",
  );
  await expect(page).toHaveURL(/\/community\/clockwork-reef-chronicle$/u);
  await expect(page.getByRole("heading", { name: "Clockwork Reef Almanac", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /Saved|Unsave/u }).first()).toBeVisible();
  await capture(page, "community-saved");
  await accountDestination(page, account, "Chronicle Passport");
  await expect(page.getByRole("heading", { name: /Chronicle Passport/u }).first()).toBeVisible();
  const saved = page.getByRole("navigation", { name: "Personal Harbor sections" }).getByRole("link", { name: "Saved" });
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(page.getByText("Clockwork Reef Almanac", { exact: true }).first()).toBeVisible();
});

test(`Journey G: profile`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Personal Harbor");
  const sections = page.getByRole("navigation", { name: "Personal Harbor sections" });
  for (const name of [
    "Public Profile",
    "Personal Information",
    "Preferences",
    "Accessibility",
    "Notifications",
    "Privacy",
    "Linked Identities",
    "Security",
    "Sessions",
  ]) {
    const link = sections.getByRole("link", { name, exact: true }).first();
    if (await link.isVisible()) await link.click();
  }
  await sections.getByRole("link", { name: "Preferences", exact: true }).first().click();
  const theme = page.getByLabel("Theme");
  await theme.selectOption("DARK");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
  await capture(page, "profile-preferences-saved");
});

test(`Journey H: chronicle passport`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Chronicle Passport");
  await expect(page.getByRole("heading", { name: /Chronicle Passport/u }).first()).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Personal Harbor sections" });
  await settledDeclaredLinkNavigation(
    page,
    navigation.getByRole("link", { name: "History", exact: true }),
    "Chronicle Passport History",
  );
  await expect(page.getByLabel("Search your history")).toBeVisible();
  await settledDeclaredLinkNavigation(page, page.getByRole("link", { name: "Open record" }).first(), "History record");
  await expect(page.getByRole("heading", { name: "Private Keepsake" })).toBeVisible();
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: /Chronicle History/u }).first(),
    "Chronicle History return",
  );
  await settledDeclaredLinkNavigation(
    page,
    navigation.getByRole("link", { name: "Memories", exact: true }),
    "Chronicle Passport Memories",
  );
  await expect(page.getByRole("heading", { name: "Memories", level: 1 })).toBeVisible();
  await settledDeclaredLinkNavigation(
    page,
    navigation.getByRole("link", { name: "Artifacts", exact: true }),
    "Chronicle Passport Artifacts",
  );
  await expect(page.getByLabel("Search artifacts")).toBeVisible();
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: "View provenance" }).first(),
    "Artifact provenance",
  );
  await expect(page.getByRole("heading", { name: "Provenance", exact: true })).toBeVisible();
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: /Artifact Cabinet/u }).first(),
    "Artifact Cabinet return",
  );
  await settledDeclaredLinkNavigation(
    page,
    navigation.getByRole("link", { name: "Saved", exact: true }),
    "Chronicle Passport Saved",
  );
  await expect(page.getByRole("heading", { name: "Saved from Community", level: 1 })).toBeVisible();
  await expect(page.getByText(/No eligible saved items|Eligibility is checked/u).first()).toBeVisible();
  await capture(page, "passport-artifacts-and-saved");
  await accountDestination(page, account, "View My Profile");
  await expect(page.getByRole("heading", { name: account.displayName })).toBeVisible();
  await expect(page.getByText("Owner preview", { exact: true })).toBeVisible();
});

test(`Journey I: password recovery`, async ({ page }) => {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLinkNavigation(page, menu.getByRole("link", { name: "Sign In", exact: true }), /\/sign-in/u);
  await settledLinkNavigation(page, page.getByRole("link", { name: "Forgot Password" }), /\/forgot-password/u);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(credentialHandoff.accounts.RECOVERY_ACCOUNT.email!);
  const recoveryResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/password-reset/request") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Send|Continue|Request/u }).click();
  expect((await recoveryResponse).ok()).toBe(true);
  await expect(page.getByText("If that email can reset an account, we sent a recovery link.")).toBeVisible();
  await Promise.all([
    db.accountToken.update({
      where: { id: "hp7-token-reset-valid" },
      data: { consumedAt: null, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    }),
    db.accountToken.update({
      where: { id: "hp7-token-reset-expired" },
      data: { consumedAt: null, expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    }),
  ]);
  await page.goto(`/reset-password?token=${encodeURIComponent("malformed-phase7-token")}`);
  await submitReset(page, `${credentialHandoff.password}New`);
  await expect(page.getByText(/invalid|expired|used/u).first()).toBeVisible();
  await page.goto(`/reset-password?token=${encodeURIComponent(tokens.resetExpired)}`);
  await submitReset(page, `${credentialHandoff.password}New`);
  await expect(page.getByText(/expired|invalid|used/u).first()).toBeVisible();
  await page.goto(`/reset-password?token=${encodeURIComponent(tokens.resetValid)}`);
  const newPassword = `${credentialHandoff.password}New`;
  await submitReset(page, newPassword);
  const recoveryAccount = credentialHandoff.accounts.RECOVERY_ACCOUNT;
  await expect(page.getByRole("button", { name: recoveryAccount.displayName, exact: true })).toBeVisible();
  const authenticatedMenu = await accountMenu(page, recoveryAccount.displayName);
  await authenticatedMenu.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "RECOVERY_ACCOUNT", newPassword);
  await accountDestination(page, recoveryAccount, "Security & Sessions");
  await capture(page, "recovery-restored-account");
});

test(`Journey J: session expiry`, async ({ page }) => {
  const account = await signIn(page, "EXPIRED_SESSION_ACCOUNT");
  const cookie = (await page.context().cookies()).find((entry) => entry.name === "wayfarer_account");
  expect(cookie).toBeTruthy();
  await db.accountSession.update({
    where: { tokenHash: createHash("sha256").update(cookie!.value).digest("hex") },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });
  await page.goto("/player/library");
  await expect(page).toHaveURL(/reason=expired/u);
  await expect(page.getByText(/session expired/u).first()).toBeVisible();
  await capture(page, "session-expired");
  await fillSignIn(page, account, credentialHandoff.password);
  await expect(page).toHaveURL(/\/player\/library/u);
});

test(`Journey K: permission`, async ({ page }) => {
  const account = await signIn(page, "PLAYER_ONLY");
  await globalDestination(page, "Community Harbor");
  await page.goto("/community/moderation");
  await expect(page.getByRole("heading", { name: /Permission|required|restricted/u }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
  await capture(page, "permission-denied-authenticated");
  await globalDestination(page, "Community Harbor");
});

test(`Journey L: mobile`, async ({ page }) => {
  await begin(page);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await globalDestination(page, "Community Harbor");
  await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
  await accountDestination(page, account, "View My Profile");
  await accountDestination(page, account, "Player");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await capture(page, "mobile-workspace");
  const menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign out" }).click();
});

test(`Journey M: sign-out and multi-tab`, async ({ context }) => {
  const first = await context.newPage();
  const account = await signIn(first, "RETURNING_FULL_CAPABILITY");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByRole("button", { name: account.displayName })).toBeVisible();
  const menu = await accountMenu(first, account.displayName);
  await menu.getByRole("button", { name: "Sign out" }).click();
  await second.bringToFront();
  await expect(second.getByRole("button", { name: account.displayName })).toHaveCount(0);
  await second.goto("/player/library");
  await expect(second).toHaveURL(/\/sign-in/u);
  await capture(second, "multi-tab-invalidated");
});

test(`Journey N: failure and recovery`, async ({ page }) => {
  await begin(page);
  await globalDestination(page, "Community Harbor");
  await page.route("**/api/community/discover?**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic discovery dependency is temporarily unavailable." }),
    });
  });
  const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
  await search.fill("dependency test");
  await search.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /Synthetic discovery dependency/u })).toBeVisible();
  await capture(page, "dependency-unavailable");
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.focus();
  await expect(retry).toBeFocused();
  await page.unroute("**/api/community/discover?**");
  await retry.click();
  await expect(page.getByRole("alert").filter({ hasText: /Synthetic discovery dependency/u })).toHaveCount(0);
});

test(`Journey O: final whole-voyage rehearsal`, async ({ page }) => {
  await begin(page);
  await keyboardMilestone(page);
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "View My Profile");
  await accountDestination(page, account, "Player");
  await accountDestination(page, account, "Chronicle Passport");
  await globalDestination(page, "Community Harbor");
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("navigation", { name: "Community Harbor districts" }).getByRole("link", { name: "Chronicles" }),
    "Community Chronicle district",
  );
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: "Clockwork Reef Almanac" }).first(),
    "Community Chronicle detail",
  );
  await expect(page).toHaveURL(/\/community\/clockwork-reef-chronicle$/u);
  await expect(page.getByRole("heading", { name: "Clockwork Reef Almanac", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /Saved|Unsave/u }).first()).toBeVisible();
  await capture(page, "whole-voyage-community");
  await leaveActiveChronicles(page, account);
  await enterWorkspaceFromOverview(page, "Creator");
  await accountDestination(page, account, "All Workspaces");
  await enterWorkspaceFromOverview(page, "Captain");
  await accountDestination(page, account, "Security & Sessions");
  const menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/u);
  await page.getByRole("link", { name: "Safe return", exact: true }).click();
  await expect(page.getByRole("button", { name: /^(Account|Session ended)$/u })).toBeVisible();
  await capture(page, "whole-voyage-anonymous-end");
});

async function begin(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole("main")).toBeVisible();
}

async function signIn(page: Page, alias: string, password = credentialHandoff.password) {
  const account = credentialHandoff.accounts[alias];
  if (!account) throw new Error(`Unknown Phase 7 alias: ${alias}`);
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await menu.getByRole("link", { name: "Sign In", exact: true }).click();
  await fillSignIn(page, account, password);
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  return account;
}

async function fillSignIn(page: Page, account: Alias, password: string) {
  await page.getByLabel("Email or legacy Player name").fill(account.email ?? account.username!);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
}

async function accountMenu(page: Page, label: string) {
  const button =
    label === "Account"
      ? page.getByRole("button", { name: /^(Account|Session ended)$/u })
      : page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  const menu = page.locator("#shell-account-disclosure");
  await expect
    .poll(
      async () => {
        if ((await button.getAttribute("aria-expanded")) !== "true") {
          await button.click();
        }
        return menu.isVisible();
      },
      {
        message: `Account disclosure should open for ${label}`,
        timeout: 30_000,
      },
    )
    .toBe(true);
  return menu;
}

async function accountDestination(page: Page, account: Alias, label: string) {
  const menu = await accountMenu(page, account.displayName);
  const link = menu.getByRole("link", { name: label, exact: true });
  if (label === "View My Profile") {
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/profile\//u);
    await page.waitForLoadState("networkidle");
    await expectSingleMain(page);
    return;
  }
  await settledDeclaredLinkNavigation(page, link, `Account destination ${label}`);
}

async function leaveActiveChronicles(page: Page, account: Alias) {
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "Creator transitions are paused", exact: true })).toBeVisible();
  await page.getByLabel(/Type LEAVE ACTIVE CHRONICLES/u).fill("LEAVE ACTIVE CHRONICLES");
  await page.getByRole("button", { name: "Safely leave active Chronicles" }).click();
  await expect(page.getByRole("link", { name: "Enter Captain" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Creator" })).toBeVisible();
}

async function enterWorkspaceFromOverview(page: Page, workspace: "Captain" | "Creator") {
  await settledDeclaredLinkNavigation(
    page,
    page.getByRole("link", { name: `Enter ${workspace}`, exact: true }),
    `Enter ${workspace} workspace`,
  );
}

async function globalDestination(page: Page, label: string) {
  const navigation = page.getByRole("navigation", { name: "Global navigation" });
  const link = navigation.getByRole("link", { name: label, exact: true });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Open navigation" }).click();
  await settledDeclaredLinkNavigation(page, link, `Global destination ${label}`);
}

async function clickFirstRoute(page: Page, prefix: string) {
  const link = page.locator(`main a[href^='${prefix}']`).first();
  await settledDeclaredLinkNavigation(page, link, `First route with prefix ${prefix}`);
}

async function settledDeclaredLinkNavigation(page: Page, link: Locator, label: string) {
  await expect(link).toBeVisible();
  const destination = await link.getAttribute("href");
  if (!destination) throw new Error(`${label} does not declare an href`);
  const pathname = new URL(destination, page.url()).pathname;
  await link.click();
  await expect
    .poll(() => new URL(page.url()).pathname, { message: `${label} should finish navigation` })
    .toBe(pathname);
  await page.waitForLoadState("networkidle");
  await expectSingleMain(page);
}

async function expectSingleMain(page: Page) {
  const main = page.getByRole("main");
  await expect(main).toHaveCount(1);
  await expect(main).toBeVisible();
}

async function settledLinkNavigation(page: Page, link: ReturnType<Page["getByRole"]>, destination: RegExp) {
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(destination);
  await page.waitForLoadState("networkidle");
}

async function submitReset(page: Page, password: string) {
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function keyboardMilestone(page: Page) {
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(focusedTag).not.toBe("BODY");
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
        return delivery?.token ?? null;
      },
      { timeout: 20_000, message: `${purpose} delivery for ${email}` },
    )
    .not.toBeNull();
  return delivery!;
}

async function capture(page: Page, suffix: string) {
  const evidenceId = `HP-P7-EV-${journeyId}-${suffix}`;
  const screenshotRoot = path.join(taskRoot, "screenshots", journeyId);
  const reportRoot = path.join(taskRoot, "reports", "journeys");
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });
  const screenshotPath = path.join(screenshotRoot, `${evidenceId}.png`);
  const image = await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(
    path.join(reportRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion: "homeport-phase7-integrated-v1",
        databasePath,
        screenshotPath,
        screenshotSha256: createHash("sha256").update(image).digest("hex"),
        browser: "Chromium 141.0.7390.37",
        viewport: page.viewportSize(),
        motionMode: "REDUCED",
        route: new URL(page.url()).pathname,
        title: await page.title(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

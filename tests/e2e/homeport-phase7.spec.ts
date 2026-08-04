import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string | null; username: string | null; email: string | null; displayName: string };
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_DATABASE_PATH"));
const credentialHandoff = JSON.parse(
  readFileSync(path.join(taskRoot, "credentials", "walkthrough-credentials.private.json"), "utf8"),
) as { password: string; accounts: Record<string, Alias> };
const tokens = JSON.parse(readFileSync(path.join(taskRoot, "tokens", "phase7-tokens.private.json"), "utf8")) as {
  resetValid: string;
  resetExpired: string;
  verifyValid: string;
};
const db = new PrismaClient();

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));
test.afterAll(async () => db.$disconnect());

test(`Journey A: account creation`, async ({ page }) => {
  await begin(page);
  await keyboardMilestone(page);
  const menu = await accountMenu(page, "Account");
  await menu.getByRole("link", { name: "Create Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Create/u })).toBeVisible();
  await page.getByLabel("Display name").fill("Phase 7 Registration Candidate");
  await page.getByLabel("Email").fill("registration-candidate@phase7.example.test");
  await page.getByLabel("Password", { exact: true }).fill(credentialHandoff.password);
  await page.getByLabel("Confirm password").fill(`${credentialHandoff.password}x`);
  await page.getByLabel("Confirm password").press("Enter");
  await expect(page.getByText(/match|same/u).first()).toBeVisible();
  await page.getByLabel("Confirm password").fill(credentialHandoff.password);
  await page.getByLabel("Confirm password").press("Enter");
  await expect(page.getByRole("button", { name: "Phase 7 Registration Candidate" })).toBeVisible();
  const signedIn = await accountMenu(page, "Phase 7 Registration Candidate");
  await signedIn.getByRole("link", { name: "View My Profile" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await capture(page, "registered-profile");
  const profileMenu = await accountMenu(page, "Phase 7 Registration Candidate");
  await profileMenu.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/u);
});

test(`Journey B: returning account`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  for (const destination of ["Player", "Captain", "Creator Studio", "View My Profile"])
    await accountDestination(page, account, destination);
  await capture(page, "cross-workspace-account");
  const menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/player/library");
  await expect(page).toHaveURL(/\/sign-in/u);
});

test(`Journey C: player`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Player");
  await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
  await clickFirstRoute(page, "/player/playthroughs/");
  await expect(page.getByRole("main")).toBeVisible();
  await capture(page, "player-voyage");
  await accountDestination(page, account, "Chronicle Passport");
  await expect(page.getByRole("heading", { name: /Chronicle Passport/u }).first()).toBeVisible();
});

test(`Journey D: captain`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Captain");
  await expect(page.getByRole("heading", { name: /Captain/u }).first()).toBeVisible();
  await clickFirstRoute(page, "/captain/sessions/");
  await expect(page.getByRole("main")).toBeVisible();
  await capture(page, "captain-session");
  await accountDestination(page, account, "View My Profile");
});

test(`Journey E: creator`, async ({ page }) => {
  const account = await signIn(page, "RETURNING_FULL_CAPABILITY");
  await accountDestination(page, account, "Creator Studio");
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
  await page
    .getByRole("navigation", { name: "Community Harbor districts" })
    .getByRole("link", { name: "Chronicles" })
    .click();
  await page.getByRole("link", { name: "Clockwork Reef Almanac" }).first().click();
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
  await accountDestination(page, account, "View My Profile");
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
    const link = sections.getByRole("link", { name, exact: true });
    if (await link.isVisible()) await link.click();
  }
  await sections.getByRole("link", { name: "Preferences", exact: true }).click();
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
  for (const name of ["History", "Memories", "Artifacts", "Saved"]) {
    const link = navigation.getByRole("link", { name, exact: true });
    if (await link.isVisible()) {
      await link.click();
      await expect(page.getByRole("main")).toBeVisible();
    }
  }
  await capture(page, "passport-artifacts-and-saved");
});

test(`Journey I: password recovery`, async ({ page }) => {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await menu.getByRole("link", { name: "Sign In", exact: true }).click();
  await page.getByRole("link", { name: "Forgot Password" }).click();
  await page.getByLabel("Email").fill(credentialHandoff.accounts.RECOVERY_ACCOUNT.email!);
  await page.getByRole("button", { name: /Send|Continue|Request/u }).click();
  await expect(page.getByText(/If an account|instructions|recovery/u).first()).toBeVisible();
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
  await page.getByRole("searchbox", { name: "Search public Community Harbor" }).fill("dependency test");
  await page.getByRole("button", { name: "Search", exact: true }).click();
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
  await page
    .getByRole("navigation", { name: "Community Harbor districts" })
    .getByRole("link", { name: "Chronicles" })
    .click();
  await page.getByRole("link", { name: "Clockwork Reef Almanac" }).first().click();
  await expect(page).toHaveURL(/\/community\/clockwork-reef-chronicle$/u);
  await expect(page.getByRole("heading", { name: "Clockwork Reef Almanac", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /Saved|Unsave/u }).first()).toBeVisible();
  await capture(page, "whole-voyage-community");
  await accountDestination(page, account, "Creator Studio");
  await accountDestination(page, account, "Captain");
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
  await button.click();
  const menu = page.locator("#shell-account-disclosure");
  await expect(menu).toBeVisible();
  return menu;
}

async function accountDestination(page: Page, account: Alias, label: string) {
  const menu = await accountMenu(page, account.displayName);
  const link = menu.getByRole("link", { name: label, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("main")).toBeVisible();
}

async function globalDestination(page: Page, label: string) {
  const navigation = page.getByRole("navigation", { name: "Global navigation" });
  const link = navigation.getByRole("link", { name: label, exact: true });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("main")).toBeVisible();
}

async function clickFirstRoute(page: Page, prefix: string) {
  const link = page.locator(`main a[href^='${prefix}']`).first();
  await expect(link).toBeVisible();
  await link.click();
}

async function submitReset(page: Page, password: string) {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function keyboardMilestone(page: Page) {
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(focusedTag).not.toBe("BODY");
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

import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchTalePlaythrough } from "../../src/chronicle/progression";
import { db } from "../../src/lib/db";
import { acceptInvitation, createPlaythroughAndInvitations } from "../../src/platform/invitations";
import { registerAccount } from "../../src/wayfarer/accounts";
import { hash } from "bcryptjs";

const password = "Signal-quartz-compass-2026";
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE2_EVIDENCE_ROOT ??
    (process.env.SOUNDING_LINE_INTERNAL_RUNTIME === "1"
      ? path.join("artifacts", "validation", "homeport-phase2", "sounding-line-evidence")
      : path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase2")),
);

type AccountFixture = {
  accountId: string;
  profileId: string;
  email: string;
  displayName: string;
  gameMasterId?: string;
  handle?: string;
};

let player: AccountFixture;
let full: AccountFixture;
let immersivePlaythroughId: string;

async function fixture(label: string, roles: string[] = [], options: { handle?: boolean; captain?: boolean } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const slug = `homeport-${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-${suffix}`;
  const email = `${slug}@example.invalid`;
  const displayName = `Homeport ${label} ${suffix}`;
  const result = await registerAccount({
    email,
    password,
    displayName,
    deviceLabel: "Homeport Phase 2 browser fixture",
  });
  await db.userAccount.update({
    where: { id: result.account.id },
    data: { status: "ACTIVE", ordinaryWorkspaceEntryAt: new Date() },
  });
  await db.accountEmail.updateMany({
    where: { accountId: result.account.id, isPrimary: true },
    data: { verificationState: "VERIFIED", verifiedAt: new Date() },
  });
  if (options.handle)
    await db.playerProfile.update({
      where: { id: result.account.profile.id },
      data: { username: slug, handle: slug, normalizedHandle: slug },
    });
  for (const role of roles) await db.accountRoleAssignment.create({ data: { accountId: result.account.id, role } });
  let gameMasterId: string | undefined;
  if (options.captain) {
    const gameMaster = await db.gameMasterUser.create({
      data: { username: slug, passwordHash: await hash(password, 4) },
    });
    gameMasterId = gameMaster.id;
    await db.userAccount.update({
      where: { id: result.account.id },
      data: { legacyGameMasterId: gameMaster.id },
    });
  }
  return {
    accountId: result.account.id,
    profileId: result.account.profile.id,
    email,
    displayName,
    gameMasterId,
    handle: options.handle ? slug : undefined,
  } satisfies AccountFixture;
}

async function createImmersiveFixture(account: AccountFixture) {
  if (!account.gameMasterId) throw new Error("The immersive fixture requires a linked Captain identity.");
  const chronicle = await db.chronicle.findFirst({
    where: { archivedAt: null, latestPublishedVersionId: { not: null } },
    include: { versions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const version = chronicle?.versions[0];
  if (!chronicle || !version) throw new Error("The isolated database has no published Chronicle fixture.");
  const created = await createPlaythroughAndInvitations(
    {
      taleId: chronicle.id,
      versionId: version.id,
      voyageName: `Homeport shell preservation ${randomUUID().slice(0, 8)}`,
      captainMode: "CAPTAIN_CONTROLLED",
      hints: "ON_REQUEST",
      sideQuests: true,
      scheduleTimezone: "America/New_York",
      accessibilityDefaults: { motion: "SYSTEM" },
      testVoyage: true,
      expiresInHours: 24,
      accountRequired: true,
      maxRedemptions: 1,
      players: [{ playerId: account.profileId, displayName: account.displayName, crewRole: "Navigator" }],
    },
    account.gameMasterId,
    "http://127.0.0.1:3188",
  );
  const invitation = created.invitations[0];
  if (!invitation) throw new Error("The immersive fixture did not create an invitation.");
  const token = new URL(invitation.link).pathname.split("/").filter(Boolean).at(-1);
  if (!token) throw new Error("The immersive fixture invitation did not expose its bounded token.");
  await acceptInvitation(token, {}, account.profileId);
  await launchTalePlaythrough(created.playthroughId, account.gameMasterId);
  return created.playthroughId;
}

const shell = (page: Page) => page.locator(".product-shell");
const accountDisclosure = (page: Page) => page.locator("#shell-account-disclosure");

async function expectShell(page: Page, mode: string, workspace?: string) {
  await expect(shell(page)).toHaveAttribute("data-shell-mode", mode);
  if (workspace) await expect(shell(page)).toHaveAttribute("data-workspace", workspace);
}

async function settleGateway(page: Page) {
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  const skipAvailable = await skip
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (skipAvailable)
    await page.evaluate(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>(".landing-controls button")].find(
        (candidate) => candidate.textContent?.trim() === "Skip opening presentation",
      );
      button?.click();
    });
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright" })).toBeVisible();
  for (const role of ["Player", "Captain", "Creator"])
    await expect(page.getByRole("heading", { name: role, exact: true })).toBeVisible();
  await expect(page.getByText("Checking access...", { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".gateway-content h1").evaluate((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return Number.parseFloat(style.opacity) >= 0.99 && bounds.left >= 0 && bounds.right <= innerWidth;
      }),
    )
    .toBe(true);
}

async function openAccountMenu(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(accountDisclosure(page)).toBeVisible();
  return accountDisclosure(page);
}

async function signInFromGateway(page: Page, account: AccountFixture) {
  await page.goto("/");
  await expectShell(page, "GATEWAY_STANDARD", "public");
  const menu = await openAccountMenu(page, "Account");
  await menu.getByRole("link", { name: "Sign In", exact: true }).click();
  await expectShell(page, "AUTHENTICATION");
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  await expectShell(page, "GATEWAY_STANDARD", "public");
  await settleGateway(page);
}

async function capture(page: Page, evidenceId: string) {
  await page.screenshot({ path: path.join(evidenceRoot, `${evidenceId}.png`), fullPage: true });
}

async function clickGlobal(page: Page, name: string) {
  const link = page.getByRole("navigation", { name: "Global navigation" }).getByRole("link", { name, exact: true });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Open navigation" }).click();
  await link.click();
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true);
}

async function visibleFunctionalIds(root: Locator) {
  return root.locator("[data-navigation-id]").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      })
      .map((node) => (node as HTMLElement).dataset.navigationId ?? "")
      .filter((id) => /^(?:global|workspace|account)-/u.test(id))
      .sort(),
  );
}

async function functionalDestinationSet(page: Page, account: AccountFixture, mobile: boolean) {
  const ids = new Set<string>();
  if (mobile) {
    const navigationButton = page.getByRole("button", { name: "Open navigation" });
    await navigationButton.click();
    for (const id of await visibleFunctionalIds(page.locator("#product-navigation-drawer"))) ids.add(id);
    await page.keyboard.press("Escape");
    await expect(navigationButton).toBeFocused();
  } else {
    for (const id of await visibleFunctionalIds(page.locator(".product-navigation-drawer"))) ids.add(id);
  }
  await openAccountMenu(page, account.displayName);
  await expect(accountDisclosure(page).locator('[data-navigation-id="account-passport"]')).toBeVisible();
  for (const id of await visibleFunctionalIds(accountDisclosure(page))) ids.add(id);
  await page.keyboard.press("Escape");
  return [...ids].sort();
}

async function navigateAccountLink(page: Page, account: AccountFixture, name: string) {
  const menu = await openAccountMenu(page, account.displayName);
  await menu.getByRole("link", { name, exact: true }).click();
  await expect(accountDisclosure(page)).toBeHidden();
}

test.describe.serial("Project Homeport Phase 2 browser journeys", () => {
  test.beforeAll(async () => {
    if (process.env.SOUNDING_LINE_INTERNAL_RUNTIME !== "1" && !process.env.HOMEPORT_PHASE2_DATABASE_PATH)
      throw new Error("HOMEPORT_PHASE2_REQUIRES_DEDICATED_OR_SOUNDING_LINE_RUNTIME");
    await mkdir(evidenceRoot, { recursive: true });
    player = await fixture("Player");
    full = await fixture("Full", ["CAPTAIN", "CREATOR"], { handle: true, captain: true });
    immersivePlaythroughId = await createImmersiveFixture(full);
  });

  test("Journey A: anonymous gateway account lifecycle", async ({ page }) => {
    await page.goto("/");
    await expectShell(page, "GATEWAY_STANDARD", "public");
    await settleGateway(page);
    await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(1);
    await capture(page, "HP-P2-EV-A-gateway-anonymous-desktop");
    let menu = await openAccountMenu(page, "Account");
    await expect(menu.getByRole("link", { name: "Create Account", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign In", exact: true })).toBeVisible();
    await capture(page, "HP-P2-EV-E-account-menu-anonymous");
    await page.mouse.click(48, 240);
    await expect(menu).toBeHidden();
    const account = page.getByRole("button", { name: "Account", exact: true });
    await account.focus();
    await page.keyboard.press("Enter");
    menu = accountDisclosure(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Create Account" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
  });

  test("Journey B: authenticated gateway identity", async ({ page }) => {
    await signInFromGateway(page, full);
    await expect(page.getByRole("button", { name: full.displayName, exact: true })).toHaveCount(1);
    await capture(page, "HP-P2-EV-B-gateway-authenticated-desktop");
    const menu = await openAccountMenu(page, full.displayName);
    await expect(menu.getByRole("link", { name: "Sign In" })).toHaveCount(0);
    await expect(menu.getByRole("heading", { name: "Workspaces" })).toBeVisible();
    for (const name of ["Player", "Captain", "Creator Studio"])
      await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
    await capture(page, "HP-P2-EV-F-account-menu-authenticated");
  });

  test("Journey C: gateway to Community Harbor", async ({ page }) => {
    await page.goto("/");
    await clickGlobal(page, "Community Harbor");
    await expect(page).toHaveURL(/\/community$/u);
    await expectShell(page, "PUBLIC_STANDARD", "community");
    await expect(page.locator('[data-navigation-id="global-community-harbor"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText("Loading public Community Harbor results.")).toBeHidden();
    await capture(page, "HP-P2-EV-K-community-shell");
    await clickGlobal(page, "Home");
    await expect(page).toHaveURL(/\/$/u);
  });

  test("Journey D: gateway to Explore Chronicles", async ({ page }) => {
    await page.goto("/");
    await clickGlobal(page, "Explore Chronicles");
    await expect(page).toHaveURL(/\/tales$/u);
    await expectShell(page, "PUBLIC_STANDARD", "public");
    await expect(page.getByRole("navigation", { name: "Global navigation" })).toBeVisible();
    await expect(page.locator('[data-navigation-id="global-explore-chronicles"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await capture(page, "HP-P2-EV-G-global-nav-public");
    await clickGlobal(page, "Home");
    await expect(page).toHaveURL(/\/$/u);
  });

  test("Journey E: Player workspace navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, player);
    await page.getByRole("link", { name: /Open My Voyages|Enter as Player/u }).click();
    await expect(page).toHaveURL(/\/player\/library$/u);
    await expectShell(page, "WORKSPACE_STANDARD", "player");
    await clickGlobal(page, "Community Harbor");
    await expect(page).toHaveURL(/\/community$/u);
    await navigateAccountLink(page, player, "View My Profile");
    await expect(page).toHaveURL(/\/account$/u);
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await navigateAccountLink(page, player, "Chronicle Passport");
    await expect(page).toHaveURL(/\/passport(?:#profile)?$/u);
    await navigateAccountLink(page, player, "Security & Sessions");
    await expect(page).toHaveURL(/\/account\/security$/u);
    await navigateAccountLink(page, player, "Player");
    await expect(page).toHaveURL(/\/player\/library$/u);
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
    await capture(page, "HP-P2-EV-H-player-navigation");
  });

  test("Journey F: Captain workspace navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, full);
    await navigateAccountLink(page, full, "Captain");
    await expect(page).toHaveURL(/\/captain\/library$/u);
    await clickGlobal(page, "Community Harbor");
    await expect(page).toHaveURL(/\/community$/u);
    await navigateAccountLink(page, full, "Chronicle Passport");
    await expect(page).toHaveURL(/\/passport$/u);
    await navigateAccountLink(page, full, "Player");
    await expect(page).toHaveURL(/\/player\/library$/u);
    await navigateAccountLink(page, full, "Captain");
    await expect(page).toHaveURL(/\/captain\/library$/u);
    await expect(page.getByRole("button", { name: full.displayName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();
    await capture(page, "HP-P2-EV-I-captain-navigation");
  });

  test("Journey G: Creator workspace navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, full);
    await navigateAccountLink(page, full, "Creator Studio");
    await expect(page).toHaveURL(/\/studio\/library$/u);
    await clickGlobal(page, "Community Harbor");
    await expect(page).toHaveURL(/\/community$/u);
    await navigateAccountLink(page, full, "Security & Sessions");
    await expect(page).toHaveURL(/\/account\/security$/u);
    await navigateAccountLink(page, full, "Creator Studio");
    await expect(page).toHaveURL(/\/studio\/library$/u);
    await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
    await capture(page, "HP-P2-EV-J-creator-navigation");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("Journey H: workspace switcher continuity", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, full);
    for (const [name, workspace, pathname] of [
      ["Player", "player", "/player/library"],
      ["Captain", "captain", "/captain/library"],
      ["Creator Studio", "creator", "/studio/library"],
      ["Player", "player", "/player/library"],
    ] as const) {
      await navigateAccountLink(page, full, name);
      await expect(page).toHaveURL(new RegExp(`${pathname.replaceAll("/", "\\/")}$`, "u"));
      await expectShell(page, "WORKSPACE_STANDARD", workspace);
      await expect(page.getByRole("button", { name: full.displayName })).toBeVisible();
      const menu = await openAccountMenu(page, full.displayName);
      const currentWorkspace = menu.locator(`[data-navigation-id="account-workspace-${workspace}"]`);
      await expect(currentWorkspace).toContainText("Current");
      await expect(currentWorkspace).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
    }
    await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
    const switcher = await openAccountMenu(page, full.displayName);
    await capture(page, "HP-P2-EV-M-workspace-switcher");
    await expect(switcher).toBeVisible();
  });

  test("Journey I: authenticated account-menu hierarchy", async ({ page }) => {
    await signInFromGateway(page, full);
    const menu = await openAccountMenu(page, full.displayName);
    for (const heading of ["Identity", "Personal Harbor", "Workspaces", "Account actions"])
      await expect(menu.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const destinations = [
      ["View My Profile", /\/account$/u, "Overview"],
      ["Chronicle Passport", /\/passport$/u, "Chronicle Passport"],
      ["Preferences", /\/account\/preferences$/u, "Preferences"],
      ["Privacy & Safety", /\/account\/privacy$/u, "Privacy & Safety"],
      ["Chronicle History", /\/passport\/history$/u, "Chronicle History"],
      ["Artifact Cabinet", /\/passport\/artifacts$/u, "Artifact Cabinet"],
      ["Security & Sessions", /\/account\/security$/u, "Security"],
    ] as const;
    for (const [name, url, heading] of destinations) {
      await navigateAccountLink(page, full, name);
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
    }
  });

  test("Journey J: anonymous mobile navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await settleGateway(page);
    await capture(page, "HP-P2-EV-C-gateway-anonymous-mobile");
    const navigation = page.getByRole("button", { name: "Open navigation" });
    await navigation.click();
    await expect(page.getByRole("navigation", { name: "Global navigation" })).toBeVisible();
    for (const name of ["Community Harbor", "Explore Chronicles"])
      await expect(
        page.getByRole("navigation", { name: "Global navigation" }).getByRole("link", { name }),
      ).toBeVisible();
    await capture(page, "HP-P2-EV-L-mobile-drawer");
    await page.keyboard.press("Escape");
    const menu = await openAccountMenu(page, "Account");
    await expect(menu.getByRole("link", { name: "Create Account" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("Journey K: authenticated mobile parity", async ({ page }) => {
    await signInFromGateway(page, full);
    await navigateAccountLink(page, full, "Player");
    await expect(page).toHaveURL(/\/player\/library$/u);
    await expectShell(page, "WORKSPACE_STANDARD", "player");
    await expect(page.locator('[data-navigation-id="workspace-player-home"]')).toBeVisible();
    const desktop = await functionalDestinationSet(page, full, false);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await functionalDestinationSet(page, full, true);
    expect(mobile).toEqual(desktop);
    await page.goto("/");
    await settleGateway(page);
    await capture(page, "HP-P2-EV-D-gateway-authenticated-mobile");
    await navigateAccountLink(page, full, "Security & Sessions");
    await expect(page).toHaveURL(/\/account\/security$/u);
    const menu = await openAccountMenu(page, full.displayName);
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/u);
  });

  test("Journey L: keyboard navigation", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.goto("/");
    const account = page.getByRole("button", { name: "Account", exact: true });
    for (
      let index = 0;
      index < 12 && !(await account.evaluate((element) => element === document.activeElement));
      index += 1
    )
      await page.keyboard.press("Tab");
    await expect(account).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(accountDisclosure(page).getByRole("link", { name: "Create Account" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(accountDisclosure(page).getByRole("link", { name: "Sign In" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    await openNavigation.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("navigation", { name: "Global navigation" }).getByRole("link", { name: "Home" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(openNavigation).toBeFocused();
  });

  test("Journey M: route-change lifecycle", async ({ page }) => {
    await signInFromGateway(page, full);
    const menu = await openAccountMenu(page, full.displayName);
    await expect(menu.getByRole("heading", { name: "Workspaces" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await menu.getByRole("link", { name: "Captain", exact: true }).click();
    await expect(page).toHaveURL(/\/captain\/library$/u);
    await expect(menu).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await page.setViewportSize({ width: 390, height: 844 });
    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    await openNavigation.click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.shellOverlay)).toBe("open");
    await page
      .getByRole("navigation", { name: "Global navigation" })
      .getByRole("link", { name: "Community Harbor" })
      .click();
    await expect(page).toHaveURL(/\/community$/u);
    await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => page.evaluate(() => document.body.dataset.shellOverlay ?? "closed")).toBe("closed");
  });

  test("Journey N: active-state matrix", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-navigation-id="global-home"]')).toHaveAttribute("aria-current", "page");
    await clickGlobal(page, "Explore Chronicles");
    await expect(page.locator('[data-navigation-id="global-explore-chronicles"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await clickGlobal(page, "Community Harbor");
    await expect(page.locator('[data-navigation-id="global-community-harbor"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto("/community/creators");
    await expect(page.locator('[data-navigation-id="global-community-harbor"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await signInFromGateway(page, full);
    await navigateAccountLink(page, full, "Player");
    await expect(page.locator('[data-navigation-id="workspace-player-home"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator('[data-navigation-id="global-home"]')).not.toHaveAttribute("aria-current", "page");
    await navigateAccountLink(page, full, "Captain");
    await expect(page.locator('[data-navigation-id="workspace-captain-voyages"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await navigateAccountLink(page, full, "Creator Studio");
    await expect(page.locator('[data-navigation-id="workspace-creator-library"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await navigateAccountLink(page, full, "Chronicle Passport");
    await expect(page.getByRole("heading", { name: "Chronicle Passport", exact: true })).toBeVisible();
    let menu = await openAccountMenu(page, full.displayName);
    await expect(menu.locator('[data-navigation-id="account-passport"]')).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await page.goto(`/profile/${full.handle}`);
    await expect(page).toHaveURL(new RegExp(`/profile/${full.handle}$`, "u"));
    await expectShell(page, "PUBLIC_STANDARD", "account");
    await expect(page.locator("main.public-profile")).toBeVisible();
    await expect(page.getByRole("heading", { name: full.displayName, exact: true })).toBeVisible();
    menu = await openAccountMenu(page, full.displayName);
    await expect(menu.locator('[data-navigation-id="account-view-profile"]')).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.context().clearCookies();
    await page.goto("/player/sign-in");
    await expectShell(page, "AUTHENTICATION", "player");
    await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
  });

  test("Journey O: compact surface exit", async ({ page }) => {
    await signInFromGateway(page, full);
    await page.goto(`/captain/sessions/${immersivePlaythroughId}`);
    await expectShell(page, "COMPACT", "captain");
    await expect(page.getByRole("navigation", { name: "Contextual navigation" })).toContainText("Captain's Console");
    await capture(page, "HP-P2-EV-N-compact-exit");
    await page.getByRole("link", { name: "Exit to Captain Voyages" }).click();
    await expect(page).toHaveURL(/\/captain\/library$/u);
    await expect(page.getByRole("button", { name: full.displayName })).toBeVisible();
  });

  test("Journey P: immersive Player exit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, full);
    const before = await db.taleSession.findUniqueOrThrow({
      where: { id: immersivePlaythroughId },
      select: {
        status: true,
        currentSequence: true,
        concurrencyVersion: true,
        currentChapterId: true,
        currentBlockId: true,
      },
    });
    const eventCountBefore = await db.taleSessionEvent.count({ where: { sessionId: immersivePlaythroughId } });
    await page.goto(`/player/playthroughs/${immersivePlaythroughId}/journal`);
    await expectShell(page, "IMMERSIVE", "player");
    await page.getByRole("button", { name: /Open the journal/u }).click();
    await expect(page.locator(".chronicle-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    await expect(page.getByRole("heading", { name: /Voyage Journal$/u })).toBeVisible();
    await expect(page.getByRole("link", { name: "Exit to My Voyages" })).toBeVisible();
    await capture(page, "HP-P2-EV-O-immersive-exit");
    await page.getByRole("link", { name: "Exit to My Voyages" }).click();
    await expect(page).toHaveURL(/\/player\/library$/u);
    const after = await db.taleSession.findUniqueOrThrow({
      where: { id: immersivePlaythroughId },
      select: {
        status: true,
        currentSequence: true,
        concurrencyVersion: true,
        currentChapterId: true,
        currentBlockId: true,
      },
    });
    expect(after).toEqual(before);
    expect(await db.taleSessionEvent.count({ where: { sessionId: immersivePlaythroughId } })).toBe(eventCountBefore);
  });

  test("Journey Q: permission-restricted destination", async ({ page }) => {
    await signInFromGateway(page, player);
    await page.goto("/community/moderation");
    await expect(page.getByRole("heading", { name: "Permission required" })).toBeVisible();
    await expect(page.getByText(/does not have Moderator permission/u)).toBeVisible();
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    await expectShell(page, "PUBLIC_STANDARD", "community");
    await capture(page, "HP-P2-EV-T-permission-return");
    await clickGlobal(page, "Home");
    await expect(page).toHaveURL(/\/$/u);
  });

  test("Journey R: current-user context unavailable", async ({ page }) => {
    let fail = true;
    await page.route("**/api/auth/context", async (route) => {
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      } else await route.continue();
    });
    await page.goto("/");
    await settleGateway(page);
    const unavailable = page.getByRole("button", { name: "Account unavailable" });
    await expect(unavailable).toBeVisible();
    const menu = await openAccountMenu(page, "Account unavailable");
    await expect(menu.getByText("Account context is unavailable")).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign In" })).toHaveCount(0);
    await capture(page, "HP-P2-EV-P-context-unavailable");
    await menu.getByRole("button", { name: "Retry account check" }).click();
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  });

  test("Journey S: 200 percent zoom", async ({ page }) => {
    // A 640 CSS-pixel viewport is the deterministic layout equivalent of a 1280px browser at 200% zoom.
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/");
    await settleGateway(page);
    await assertNoHorizontalOverflow(page);
    await capture(page, "HP-P2-EV-Q-zoom-gateway");
    await signInFromGateway(page, full);
    await openAccountMenu(page, full.displayName);
    await assertNoHorizontalOverflow(page);
    await capture(page, "HP-P2-EV-R-zoom-account-menu");
    await page.keyboard.press("Escape");
    await clickGlobal(page, "Community Harbor");
    await assertNoHorizontalOverflow(page);
    await page.goto(`/captain/sessions/${immersivePlaythroughId}`);
    await expect(page.getByRole("link", { name: "Exit to Captain Voyages" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("Journey T: reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settleGateway(page);
    await expect(page.locator("main.harbor-landing")).toHaveAttribute("data-motion-mode", "reduced");
    await expect(page.getByRole("navigation", { name: "Global navigation" })).toBeVisible();
    await openAccountMenu(page, "Account");
    await page.keyboard.press("Escape");
    await capture(page, "HP-P2-EV-S-reduced-motion");
    await signInFromGateway(page, full);
    await page.goto(`/player/playthroughs/${immersivePlaythroughId}/journal`);
    await expect(page.getByRole("link", { name: "Exit to My Voyages" })).toBeVisible();
  });

  test("Journey U: Phase 1 regression continuity", async ({ page }) => {
    await signInFromGateway(page, full);
    for (const [name, pathPattern] of [
      ["Player", /\/player\/library$/u],
      ["Captain", /\/captain\/library$/u],
      ["Creator Studio", /\/studio\/library$/u],
      ["Chronicle Passport", /\/passport$/u],
    ] as const) {
      await navigateAccountLink(page, full, name);
      await expect(page).toHaveURL(pathPattern);
      await expect(page.getByRole("button", { name: full.displayName })).toBeVisible();
    }
    const menu = await openAccountMenu(page, full.displayName);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });
});

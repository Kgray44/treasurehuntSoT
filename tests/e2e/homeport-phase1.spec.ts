import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { registerAccount } from "../../src/wayfarer/accounts";

const password = "Signal-quartz-compass-2026";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const evidenceRoot = process.env.HOMEPORT_PHASE1_EVIDENCE_ROOT
  ? path.resolve(process.env.HOMEPORT_PHASE1_EVIDENCE_ROOT)
  : null;
type AccountFixture = { accountId: string; profileId: string; email: string; displayName: string };
type BrowserFetchInit = Readonly<{
  method?: "GET" | "POST";
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}>;
let player: AccountFixture;
let full: AccountFixture;
let removableCaptain: AccountFixture;
let legacyStaff: AccountFixture;
let multiTabPlayer: AccountFixture;

async function fixture(label: string, roles: string[] = []): Promise<AccountFixture> {
  const suffix = randomUUID().slice(0, 8);
  const email = `homeport-${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-${suffix}@example.invalid`;
  const displayName = `Homeport ${label} ${suffix}`;
  const result = await registerAccount({
    email,
    password,
    displayName,
    deviceLabel: "Homeport Phase 1 browser fixture",
  });
  await db.userAccount.update({
    where: { id: result.account.id },
    data: { status: "ACTIVE", ordinaryWorkspaceEntryAt: new Date() },
  });
  await db.accountEmail.updateMany({
    where: { accountId: result.account.id, isPrimary: true },
    data: { verificationState: "VERIFIED", verifiedAt: new Date() },
  });
  for (const role of roles) await db.accountRoleAssignment.create({ data: { accountId: result.account.id, role } });
  if (label === "Full") {
    const gameMaster = await db.gameMasterUser.create({
      data: { username: `homeport-full-${suffix}`, passwordHash: await hash(password, 4) },
    });
    await db.userAccount.update({ where: { id: result.account.id }, data: { legacyGameMasterId: gameMaster.id } });
  }
  return { accountId: result.account.id, profileId: result.account.profile.id, email, displayName };
}

async function browserJson<T>(page: Page, url: string, init?: BrowserFetchInit) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, {
        method: requestInit?.method,
        credentials: "same-origin",
        headers: {
          ...(requestInit?.body === undefined ? {} : { "content-type": "application/json" }),
          ...(requestInit?.headers ?? {}),
        },
        body: requestInit?.body === undefined ? undefined : JSON.stringify(requestInit.body),
      });
      return { status: response.status, body: (await response.json().catch(() => null)) as T };
    },
    { requestUrl: url, requestInit: init },
  );
}

async function signInFromGateway(page: Page, account: AccountFixture, destination = "/player/library") {
  await page.goto("/");
  await page.getByRole("link", { name: /Enter as Player|Open My Voyages/u }).click();
  await page.getByRole("link", { name: "Continue to account sign-in" }).click();
  await expect(page.getByRole("link", { name: "Create Account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot Password" })).toBeVisible();
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`, "u"));
  await expect(page.getByRole("button", { name: account.displayName })).toBeVisible();
}

async function openAccountMenu(page: Page, account: AccountFixture) {
  await page.getByRole("button", { name: account.displayName }).click();
  return page.locator("#shell-account-disclosure");
}

async function currentSession(page: Page) {
  const cookie = (await page.context().cookies()).find((item) => item.name === "wayfarer_account");
  expect(cookie).toBeTruthy();
  return db.accountSession.findUniqueOrThrow({
    where: { tokenHash: createHash("sha256").update(cookie!.value).digest("hex") },
  });
}

async function capture(page: Page, evidenceId: string) {
  if (!evidenceRoot) return;
  await page.screenshot({ path: path.join(evidenceRoot, `${evidenceId}.png`), fullPage: true });
}

async function verificationCodeFor(email: string) {
  const outboxPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  let code: string | undefined;
  await expect
    .poll(
      () => {
        if (!outboxPath || !existsSync(outboxPath)) return null;
        const delivery = readFileSync(outboxPath, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { purpose?: string; email?: string; token?: string })
          .find((entry) => entry.purpose === "VERIFY_EMAIL" && entry.email === email.toLocaleLowerCase("en-US"));
        code = delivery?.token;
        return code ?? null;
      },
      { timeout: 20_000, message: `verification delivery for ${email}` },
    )
    .not.toBeNull();
  return code!;
}

test.describe.serial("Project Homeport Phase 1 browser journeys", () => {
  test.beforeAll(async () => {
    if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true });
    player = await fixture("Player");
    full = await fixture("Full", ["CAPTAIN", "CREATOR"]);
    removableCaptain = await fixture("Role Removal", ["CAPTAIN"]);
    legacyStaff = await fixture("Legacy Staff", ["CAPTAIN"]);
    multiTabPlayer = await fixture("Multi Tab");
  });

  test("Journey A: anonymous reaches canonical sign-in and arrives without anonymous flash", async ({ page }) => {
    const pageErrors: string[] = [];
    const requestedUrls: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => requestedUrls.push(`${request.method()} ${request.url()}`));
    await page.goto("/");
    await page.getByRole("link", { name: "Enter as Player" }).click();
    await page.getByRole("link", { name: "Continue to account sign-in" }).click();
    await expect(page.getByRole("link", { name: "Create Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot Password" })).toBeVisible();
    await capture(page, "HP-P1-EV-A-sign-in-desktop");
    await page.evaluate(() => {
      (window as typeof window & { homeportAnonymousFlash?: string[] }).homeportAnonymousFlash = [];
      new MutationObserver(() => {
        if (
          location.pathname === "/player/library" &&
          document.querySelector(".shell-profile-name")?.textContent === "Account"
        )
          (window as typeof window & { homeportAnonymousFlash?: string[] }).homeportAnonymousFlash?.push("anonymous");
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
    await page.getByLabel("Email or legacy Player name").fill(player.email);
    await page.getByLabel("Password").fill(password);
    await expect(page.getByLabel("Email or legacy Player name")).toHaveValue(player.email);
    await expect(page.getByLabel("Password")).toHaveValue(password);
    await page.getByLabel("Password").press("Enter");
    expect(pageErrors).toEqual([]);
    await expect
      .poll(() => requestedUrls.some((value) => value.includes("POST") && value.includes("/api/auth/sign-in")))
      .toBe(true);
    await expect(page).toHaveURL(/\/player\/library$/u);
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as typeof window & { homeportAnonymousFlash?: string[] }).homeportAnonymousFlash,
      ),
    ).toEqual([]);
  });

  test("Journey B: visible registration establishes canonical context and intended return", async ({ page }) => {
    const suffix = randomUUID().slice(0, 8);
    await page.goto("/");
    await page.getByRole("link", { name: "Enter as Player" }).click();
    await page.getByRole("link", { name: "Continue to account sign-in" }).click();
    await page.getByRole("link", { name: "Create Account" }).click();
    await page.getByLabel("Display name").fill(`Homeport Registration ${suffix}`);
    const email = `homeport-registration-${suffix}@example.invalid`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByLabel("Confirm password").press("Enter");
    await expect(page).toHaveURL(/\/verify-email\?.*returnTo=%2Fplayer%2Flibrary/u);
    await page.getByLabel("Code").fill(await verificationCodeFor(email));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/player\/library$/u);
    await expect(page.getByRole("button", { name: `Homeport Registration ${suffix}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
    await capture(page, "HP-P1-EV-B-registration-return");
    expect((await page.context().cookies()).filter((item) => item.name === "wayfarer_account")).toHaveLength(1);
  });

  test("Journey C: Player context remains coherent through Passport and reload", async ({ page }) => {
    await signInFromGateway(page, player);
    const menu = await openAccountMenu(page, player);
    await expect(menu.getByRole("link", { name: "Chronicle Passport" })).toBeVisible();
    await menu.getByRole("link", { name: "Chronicle Passport" }).click();
    await expect(page.getByRole("heading", { name: "Chronicle Passport" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    await capture(page, "HP-P1-EV-C-passport-continuity");
  });

  test("Journeys D-F: one full account crosses Player, Captain, Creator, Passport, and Player without credentials", async ({
    page,
  }) => {
    await signInFromGateway(page, full);
    let menu = await openAccountMenu(page, full);
    await menu.getByRole("link", { name: "Captain", exact: true }).click();
    await expect(page).toHaveURL(/\/captain\/library$/u);
    await expect(page.getByRole("heading", { name: /Captain/u }).first()).toBeVisible();
    menu = await openAccountMenu(page, full);
    await menu.getByRole("link", { name: "Creator Studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/library$/u);
    menu = await openAccountMenu(page, full);
    await menu.getByRole("link", { name: "Chronicle Passport" }).click();
    await expect(page).toHaveURL(/\/passport$/u);
    await page.goto("/player/library");
    await expect(page.getByRole("button", { name: full.displayName })).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await capture(page, "HP-P1-EV-F-workspace-continuity");
  });

  test("Journey G: authenticated non-moderator receives permission denial and remains signed in", async ({ page }) => {
    await signInFromGateway(page, player);
    await page.goto("/community/moderation");
    await expect(page.getByRole("heading", { name: "Permission required" })).toBeVisible();
    await expect(page.getByText(/does not have Moderator permission/u)).toBeVisible();
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    await capture(page, "HP-P1-EV-G-permission-denied");
  });

  test("Journey H: expired session explains expiry and safely returns after sign-in", async ({ page }) => {
    await signInFromGateway(page, player);
    const session = await currentSession(page);
    await db.accountSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await page.goto("/player/library");
    await expect(page).toHaveURL(/\/sign-in\?.*reason=expired/u);
    await expect(page.getByText(/Your session expired/u)).toBeVisible();
    await capture(page, "HP-P1-EV-H-session-expired");
    await page.getByLabel("Email or legacy Player name").fill(player.email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel("Password").press("Enter");
    await expect(page).toHaveURL(/\/player\/library$/u);
  });

  test("Journey I: visible sign-out removes profile and protects the workspace", async ({ page }) => {
    await signInFromGateway(page, player);
    const menu = await openAccountMenu(page, player);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/u);
    await page.goto("/player/library");
    await expect(page).toHaveURL(/\/sign-in\?/u);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: player.displayName })).toHaveCount(0);
    await capture(page, "HP-P1-EV-I-sign-out-complete");
  });

  test("Journey J: multi-tab sign-out reconciles the second tab and denies protected work", async ({ context }) => {
    const first = await context.newPage();
    await signInFromGateway(first, multiTabPlayer);
    const second = await context.newPage();
    await second.goto("/tales");
    await expect(second.getByRole("button", { name: multiTabPlayer.displayName })).toBeVisible();
    const menu = await openAccountMenu(first, multiTabPlayer);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await second.bringToFront();
    await expect(second.getByRole("button", { name: multiTabPlayer.displayName })).toHaveCount(0);
    await second.goto("/player/library");
    await expect(second).toHaveURL(/\/sign-in\?/u);
    await expect(second.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await capture(second, "HP-P1-EV-J-multitab-sign-out");
  });

  test("Journey K: role removal preserves the ordinary Captain workspace and Player identity", async ({ page }) => {
    await signInFromGateway(page, removableCaptain);
    await db.accountRoleAssignment.updateMany({
      where: { accountId: removableCaptain.accountId, role: "CAPTAIN", revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await page.bringToFront();
    await page.goto("/captain/library");
    await expect(page.getByRole("heading", { name: /Captain/u }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: removableCaptain.displayName })).toBeVisible();
    await page.goto("/player/library");
    await expect(page).toHaveURL(/\/player\/library$/u);
    await capture(page, "HP-P1-EV-K-role-removal");
  });

  test("Journey L: legacy Player cookie rotates once into canonical context", async ({ page }) => {
    const raw = `homeport-legacy-player-${randomUUID()}`;
    await db.playerIdentitySession.create({
      data: {
        playerProfileId: player.profileId,
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        csrfToken: `csrf-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await page.context().addCookies([{ name: "chronicle_player", value: raw, url: baseURL }]);
    await page.goto("/tales");
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    const names = (await page.context().cookies()).map((item) => item.name);
    expect(names).toContain("wayfarer_account");
    expect(names).not.toContain("chronicle_player");
    await capture(page, "HP-P1-EV-L-legacy-player-rotation");
  });

  test("Journey M: historical staff cookie bridges to exact canonical permission", async ({ page }) => {
    const raw = `homeport-legacy-staff-${randomUUID()}`;
    const gm = await db.gameMasterUser.create({
      data: { username: `homeport-${randomUUID()}`, passwordHash: await hash(password, 4) },
    });
    await db.userAccount.update({ where: { id: legacyStaff.accountId }, data: { legacyGameMasterId: gm.id } });
    await db.gameMasterSession.create({
      data: {
        id: createHash("sha256").update(raw).digest("hex"),
        userId: gm.id,
        csrfToken: `csrf-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await page.context().addCookies([{ name: "forever_gm", value: raw, url: baseURL }]);
    await page.goto("/tales");
    await expect(page.getByRole("button", { name: legacyStaff.displayName })).toBeVisible();
    await page.goto("/captain/library");
    await expect(page).toHaveURL(/\/captain\/library$/u);
    expect((await page.context().cookies()).map((item) => item.name)).not.toContain("forever_gm");
    await capture(page, "HP-P1-EV-M-legacy-staff-bridge");
  });

  test("Journey N: invitation handoff remains bounded and establishes canonical Player context", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInFromGateway(page, full);
    const status = await browserJson<{ csrfToken: string }>(page, "/api/auth/context");
    expect(status.status).toBe(200);
    const library = await browserJson<{ publishedTales: Array<{ id: string; versions: Array<{ id: string }> }> }>(
      page,
      "/api/captain/library",
    );
    const source = library.body.publishedTales.find((tale) => tale.versions.length > 0);
    expect(source).toBeTruthy();
    const voyage = await browserJson<{ playthroughId: string; invitations: Array<{ link: string }> }>(
      page,
      "/api/captain/playthroughs",
      {
        method: "POST",
        headers: { "x-csrf-token": status.body.csrfToken },
        body: {
          taleId: source!.id,
          versionId: source!.versions[0]!.id,
          voyageName: `Homeport invitation ${randomUUID().slice(0, 8)}`,
          captainMode: "CAPTAIN_CONTROLLED",
          hints: "ON_REQUEST",
          sideQuests: true,
          scheduleTimezone: "America/New_York",
          accessibilityDefaults: { motion: "SYSTEM" },
          expiresInHours: 24,
          accountRequired: false,
          maxRedemptions: 1,
          players: [{ displayName: "Homeport Invitation Navigator", crewRole: "Navigator" }],
        },
      },
    );
    expect(voyage.status).toBe(201);
    const menu = await openAccountMenu(page, full);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await page.goto(voyage.body.invitations[0]!.link);
    await expect(page.locator("main.invitation-page")).toHaveAttribute("data-invitation-state", "valid");
    await page.getByRole("button", { name: "Accept and join voyage" }).click();
    await expect(page).toHaveURL(new RegExp(`/player/playthroughs/${voyage.body.playthroughId}$`, "u"));
    const names = (await page.context().cookies()).map((cookie) => cookie.name);
    expect(names).toContain("wayfarer_account");
    expect(names).not.toContain("chronicle_pending_invitation");
    expect(names).not.toContain("chronicle_player");
    await expect(page.getByRole("button", { name: "Homeport Invitation Navigator" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Homeport invitation/u })).toBeVisible();
    await expect(page.locator("main.waiting-room")).toHaveAttribute("data-connection-state", /live|polling|offline/u);
    await expect(page.locator("main.waiting-room h1")).toBeFocused();
    await capture(page, "HP-P1-EV-N-invitation-handoff");
  });

  test("Journey O: malicious return destinations fall back internally", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-in?returnTo=https%3A%2F%2Fattacker.invalid%2Fcollect");
    await page.getByLabel("Email or legacy Player name").fill(player.email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel("Password").press("Enter");
    await expect(page).toHaveURL(/\/passport$/u);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
    await expect(page.getByRole("heading", { name: "Chronicle Passport" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.locator('[data-route-layer="/passport"]')).toHaveCSS("opacity", "1");
    await capture(page, "HP-P1-EV-O-safe-return");
  });

  test("Journey P: mobile lifecycle reaches context and signs out", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInFromGateway(page, player);
    await expect(page.getByRole("button", { name: player.displayName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
    await capture(page, "HP-P1-EV-P-mobile-context");
    const menu = await openAccountMenu(page, player);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/u);
  });

  test("Journey Q: 200 percent zoom preserves auth, registration, expiry, and permission state layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/sign-in?reason=expired&returnTo=%2Fplayer%2Flibrary");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByText(/Your session expired/u)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    ).toBe(true);
    await page.goto("/register");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    ).toBe(true);
    await signInFromGateway(page, player);
    await page.goto("/community/moderation");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("heading", { name: "Permission required" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    ).toBe(true);
    await capture(page, "HP-P1-EV-Q-zoom-permission");
  });
});

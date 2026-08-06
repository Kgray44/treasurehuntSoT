import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string; email: string; displayName: string };
type Delivery = { purpose: string; email: string; token?: string; accountId: string; detail?: string };
type MediaFixture = {
  validAvatar: string;
  validAvatarReplacement: string;
  validBanner: string;
  malformed: string;
  unsupported: string;
  oversized: string;
};

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID");
const sourceSha = process.env.HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA ?? "IMPLEMENTATION_SOURCE_PENDING";
const databasePath = path.resolve(required("HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH"));
const outboxPath = path.join(taskRoot, "synthetic-outbox", `round3-journey-${journeyId}.jsonl`);
const handoff = JSON.parse(
  readFileSync(
    path.join(taskRoot, "credentials", "owner-correction-round3-walkthrough-credentials.private.json"),
    "utf8",
  ),
) as { password: string; accounts: Record<string, Alias> };
const privateCodes = JSON.parse(
  readFileSync(path.join(taskRoot, "tokens", "owner-correction-round3-email-codes.private.json"), "utf8"),
) as { pendingCurrentCode: string; pendingReplacedCode: string };
const fixtureReceipt = JSON.parse(
  readFileSync(path.join(taskRoot, "reports", "owner-correction-round3-fixture-prepare-receipt.json"), "utf8"),
) as {
  fixtureVersion: string;
  email: { providerStatus: string };
  media: { fixtureFiles: MediaFixture };
};
const media = fixtureReceipt.media.fixtureFiles;
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  rmSync(outboxPath, { force: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
});
test.afterAll(async () => db.$disconnect());

test("Journey A: Avatar selection and crop", async ({ page }) => {
  const account = await signIn(page, "NO_PROFILE_MEDIA");
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-avatar-file").setInputFiles(media.validAvatar);
  const dialog = page.getByRole("dialog", { name: "Position your avatar" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByAltText("Selected image preview")).toBeVisible();
  await capture(page, "HP-OWCR3-EV-A-AVATAR-SELECTED");

  const frame = dialog.getByLabel("avatar crop position");
  await frame.press("ArrowRight");
  await dialog.getByRole("slider").fill("1.45");
  await dialog.getByRole("button", { name: "Reset" }).click();
  await frame.press("Shift+ArrowLeft");
  await frame.press("ArrowDown");
  await expect(dialog.getByText(/Zoom 1\.00/u)).toBeVisible();
  await capture(page, "HP-OWCR3-EV-B-AVATAR-CROP");
  await dialog.getByRole("button", { name: "Use this crop" }).click();

  const pending = page.locator('[aria-label="Pending avatar actions"]');
  await expect(pending).toBeVisible();
  await expect(page.getByLabel("Current avatar preview").getByAltText("Pending avatar crop preview")).toBeVisible();
  await capture(page, "HP-OWCR3-EV-C-AVATAR-INLINE-PREVIEW");
  await pending.getByRole("button", { name: "Save avatar image" }).click();
  await expect(page.getByText(/Image normalized and stored/u)).toBeVisible();
  await expect(page.getByLabel("Current avatar preview").locator("img")).toBeVisible();

  await page.getByLabel("Handle").fill("review-empty-test");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();

  await accountDestination(page, account, "Overview");
  await expect(page.locator(".harbor-identity-hero__avatar img")).toBeVisible();
  const trigger = page.getByRole("button", { name: account.displayName, exact: true });
  await expect(trigger.locator("img")).toBeVisible();
  await capture(page, "HP-OWCR3-EV-G-ACCOUNT-TRIGGER-AVATAR");
  const menu = await accountMenu(page, account.displayName);
  await expect(menu.locator(".account-identity-summary .shell-avatar img")).toBeVisible();
  await capture(page, "HP-OWCR3-EV-H-ACCOUNT-MENU-AVATAR");
  await settledLink(page, menu.getByRole("link", { name: "Personal Harbor", exact: true }));
  await settledLink(page, page.getByRole("link", { name: "View Public Profile" }));
  await expect(page.locator("img.public-profile__avatar")).toBeVisible();
});

test("Journey B: Banner selection and crop", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-banner-file").setInputFiles(media.validBanner);
  const dialog = page.getByRole("dialog", { name: "Position your banner" });
  await expect(dialog.getByText("Mobile safe area", { exact: true })).toBeVisible();
  await dialog.getByRole("slider").fill("1.22");
  await dialog.getByLabel("banner crop position").press("Shift+ArrowRight");
  await capture(page, "HP-OWCR3-EV-D-BANNER-CROP");
  await dialog.getByRole("button", { name: "Use this crop" }).click();
  const pending = page.locator('[aria-label="Pending banner actions"]');
  await expect(pending).toBeVisible();
  await capture(page, "HP-OWCR3-EV-E-BANNER-INLINE-PREVIEW");
  await pending.getByRole("button", { name: "Save banner image" }).click();
  await expect(page.getByText(/Image normalized and stored/u)).toBeVisible();
  await accountDestination(page, account, "Overview");
  await expect(page.locator(".harbor-identity-hero__banner img")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".harbor-identity-hero__banner img")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("Journey C: Image replacement failure", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  const before = await db.playerProfile.findFirstOrThrow({
    where: { accountId: account.accountId },
    select: { avatarMediaId: true },
  });
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-avatar-file").setInputFiles(media.malformed);
  await page
    .getByRole("dialog", { name: "Position your avatar" })
    .getByRole("button", { name: "Use this crop" })
    .click();
  await page
    .locator('[aria-label="Pending avatar actions"]')
    .getByRole("button", { name: "Save avatar image" })
    .click();
  await expect(page.locator('.ui-mutation-status[role="alert"]')).toContainText(/decode|image|malformed|supported/u);
  expect(
    (
      await db.playerProfile.findFirstOrThrow({
        where: { accountId: account.accountId },
        select: { avatarMediaId: true },
      })
    ).avatarMediaId,
  ).toBe(before.avatarMediaId);

  await page.locator("#profile-avatar-file").setInputFiles(media.validAvatarReplacement);
  await page
    .getByRole("dialog", { name: "Position your avatar" })
    .getByRole("button", { name: "Use this crop" })
    .click();
  await page
    .locator('[aria-label="Pending avatar actions"]')
    .getByRole("button", { name: "Save avatar image" })
    .click();
  await expect(page.getByText(/Image normalized and stored/u)).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await db.playerProfile.findFirstOrThrow({
            where: { accountId: account.accountId },
            select: { avatarMediaId: true },
          })
        ).avatarMediaId,
    )
    .not.toBe(before.avatarMediaId);
});

test("Journey D: Image removal", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  await accountDestination(page, account, "Public Profile");
  await page.getByRole("button", { name: "Remove avatar", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Remove this avatar?" })
    .getByRole("button", { name: "Remove avatar" })
    .click();
  await expect(page.getByText("Avatar removed.")).toBeVisible();
  await expect(page.getByLabel("Current avatar preview").locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove banner", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Remove this banner?" })
    .getByRole("button", { name: "Remove banner" })
    .click();
  await expect(page.getByText("Banner removed.")).toBeVisible();
  await expect(page.getByLabel("Current banner preview").locator("img")).toHaveCount(0);
  await accountDestination(page, account, "Overview");
  await expect(page.locator(".harbor-identity-hero__avatar img")).toHaveCount(0);
  await expect(page.locator(".harbor-identity-hero__banner img")).toHaveCount(0);
});

test("Journey E: Profile Overview", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  await accountDestination(page, account, "Overview");
  const hero = page.locator(".harbor-identity-hero");
  await expect(hero.getByRole("heading", { name: account.displayName })).toBeVisible();
  await expect(hero.locator(".harbor-identity-hero__avatar img")).toBeVisible();
  await expect(hero.locator(".harbor-identity-hero__banner img")).toBeVisible();
  await expect(page.locator("[role=progressbar]")).toHaveCount(0);
  await capture(page, "HP-OWCR3-EV-F-PROFILE-OVERVIEW-IDENTITY");

  await signOut(page, account);
  const noMedia = await signIn(page, "NO_PROFILE_MEDIA");
  await accountDestination(page, noMedia, "Overview");
  await expect(page.getByText("Finish your public Profile")).toBeVisible();
  await expect(page.getByRole("link", { name: "Set handle" })).toBeVisible();
  await capture(page, "HP-OWCR3-EV-I-PROFILE-HANDLE-PROMPT");
});

test("Journey F: New registration to code verification", async ({ page }) => {
  const email = uniqueEmail("round3-registration");
  await openRegistration(page);
  await capture(page, "HP-OWCR3-EV-J-REGISTRATION");
  await register(page, "Round Three Registration", email);
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  await expect(page.getByText(maskedEmailPattern(email))).toBeVisible();
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await capture(page, "HP-OWCR3-EV-K-VERIFICATION-CODE");
  const wrong = delivery.token === "000000" ? "111111" : "000000";
  await verifyCode(page, wrong);
  await expect(page.locator("#account-status")).toContainText(/incorrect|invalid|try again/u);
  await capture(page, "HP-OWCR3-EV-L-VERIFICATION-INVALID");
  await verifyCode(page, delivery.token!);
  await expect(page.getByRole("button", { name: "Round Three Registration", exact: true })).toBeVisible();
  await capture(page, "HP-OWCR3-EV-M-VERIFICATION-SUCCESS");
});

test("Journey G: Resend and code replacement", async ({ page }) => {
  const account = handoff.accounts.PENDING_VERIFICATION;
  await signInPending(page, account);
  const resend = page.getByRole("button", { name: /Resend code|Resend available/u });
  await expect(resend).toBeEnabled();
  await resend.click();
  const replacement = await waitForDelivery("VERIFY_EMAIL", account.email);
  await expect(page.locator("#account-status")).toContainText(/new (?:six-digit|verification) code/u);
  await verifyCode(page, privateCodes.pendingCurrentCode);
  await expect(page.locator("#account-status")).toContainText(/incorrect|invalid|replaced/u);
  await verifyCode(page, replacement.token!);
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  const challenges = await db.accountToken.findMany({
    where: { accountId: account.accountId, purpose: "VERIFY_EMAIL" },
    select: { consumedAt: true },
  });
  expect(challenges.filter((challenge) => challenge.consumedAt).length).toBeGreaterThanOrEqual(2);
});

test("Journey H: Change registration email", async ({ page }) => {
  const account = handoff.accounts.PENDING_VERIFICATION;
  const replacementEmail = uniqueEmail("round3-email-change");
  await signInPending(page, account);
  await page.getByRole("button", { name: "Change email" }).click();
  await page.getByLabel("New registration email").fill(replacementEmail);
  await page.getByRole("button", { name: "Send code to new email" }).click();
  const replacement = await waitForDelivery("VERIFY_EMAIL", replacementEmail);
  await expect(page.getByText(maskedEmailPattern(replacementEmail))).toBeVisible();
  await verifyCode(page, privateCodes.pendingCurrentCode);
  await expect(page.locator("#account-status")).toContainText(/incorrect|invalid|replaced/u);
  await verifyCode(page, replacement.token!);
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  const primary = await db.accountEmail.findFirstOrThrow({
    where: { accountId: account.accountId, isPrimary: true },
    select: { normalizedEmail: true, verificationState: true },
  });
  expect(primary.normalizedEmail).toBe(replacementEmail);
  expect(primary.verificationState).toBe("VERIFIED");
});

test("Journey I: Postmark live delivery or explicit external blocker", async ({ page }) => {
  expect(fixtureReceipt.email.providerStatus).toBe("POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION");
  const email = uniqueEmail("round3-postmark-equivalent");
  await openRegistration(page);
  await register(page, "Postmark Synthetic Equivalent", email);
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  expect(delivery.token).toMatch(/^\d{6}$/u);
  await verifyCode(page, delivery.token!);
  await expect(page.getByRole("button", { name: "Postmark Synthetic Equivalent", exact: true })).toBeVisible();
  const account = await db.accountEmail.findFirstOrThrow({
    where: { normalizedEmail: email },
    select: { accountId: true },
  });
  expect(
    await db.transactionalEmailDelivery.count({ where: { accountId: account.accountId, purpose: "VERIFY_EMAIL" } }),
  ).toBe(1);
});

test("Journey J: KGTesting workspace provisioning", async ({ page }) => {
  const account = await signIn(page, "KGTESTING_NEW");
  await accountDestination(page, account, "All Workspaces");
  await expectWorkspaceEntry(page, "Player");
  await expectWorkspaceEntry(page, "Captain");
  await expectWorkspaceEntry(page, "Creator");
  await expect(page.getByText("No Captain Voyages yet.")).toBeVisible();
  await expect(page.getByText("Create your first Chronicle.")).toBeVisible();
  expect(
    await db.accountRoleAssignment.count({
      where: { accountId: account.accountId, revokedAt: null, role: { in: ["CAPTAIN", "CREATOR"] } },
    }),
  ).toBe(0);
  await capture(page, "HP-OWCR3-EV-N-KGTESTING-WORKSPACES");

  await settledLink(page, page.getByRole("link", { name: "Enter Captain" }));
  await expect(page.getByRole("heading", { name: "No Captain Voyages yet" })).toBeVisible();
  await capture(page, "HP-OWCR3-EV-O-CAPTAIN-EMPTY");
  await accountDestination(page, account, "All Workspaces");
  await settledLink(page, page.getByRole("link", { name: "Enter Creator" }));
  await expect(page.getByRole("heading", { name: "No Chronicles yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Create Chronicle/u }).first()).toBeVisible();
  await capture(page, "HP-OWCR3-EV-P-CREATOR-EMPTY");
});

test("Journey K: Existing-account reconciliation", async ({ page }) => {
  const account = handoff.accounts.SERA_OWNER;
  const roleCount = await db.accountRoleAssignment.count({ where: { accountId: account.accountId } });
  await db.userAccount.update({ where: { id: account.accountId }, data: { ordinaryWorkspaceEntryAt: null } });
  const dryRun = runReconciliation(account.accountId, []);
  expect(dryRun.mode).toBe("DRY_RUN");
  expect(dryRun.accounts[0]?.changed).toBe(true);
  const committed = runReconciliation(account.accountId, ["--commit"]);
  expect(committed.mode).toBe("COMMIT");
  expect(committed.accounts[0]?.changed).toBe(true);
  const repeated = runReconciliation(account.accountId, ["--commit"]);
  expect(repeated.accounts[0]?.changed).toBe(false);
  const verified = runReconciliation(account.accountId, ["--verify"]);
  expect(verified.verified).toBe(true);
  expect(await db.accountRoleAssignment.count({ where: { accountId: account.accountId } })).toBe(roleCount);

  await signIn(page, "SERA_OWNER");
  await accountDestination(page, account, "All Workspaces");
  for (const workspace of ["Player", "Captain", "Creator"]) await expectWorkspaceEntry(page, workspace);
});

test("Journey L: Active Chronicle lock", async ({ page }) => {
  const account = await signIn(page, "ACTIVE_PLAYER_LOCKED");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Captain" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Enter Creator" })).toHaveCount(0);
  await capture(page, "HP-OWCR3-EV-Q-ACTIVE-CHRONICLE-LOCK");
  await page.getByLabel(/Type LEAVE ACTIVE CHRONICLES/u).fill("LEAVE ACTIVE CHRONICLES");
  await page.getByRole("button", { name: "Safely leave active Chronicles" }).click();
  await expect(page.getByText("Active Player participation ended safely.")).toBeVisible();
  await expectWorkspaceEntry(page, "Captain");
  await expectWorkspaceEntry(page, "Creator");
});

test("Journey M: No false active lock", async ({ page }) => {
  const account = handoff.accounts.ACTIVE_PLAYER_LOCKED;
  await db.playthroughMembership.updateMany({
    where: { player: { accountId: account.accountId } },
    data: { status: "COMPLETED" },
  });
  await signIn(page, "ACTIVE_PLAYER_LOCKED");
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "Captain and Creator transitions are paused" })).toHaveCount(0);
  await expectWorkspaceEntry(page, "Captain");
  await expectWorkspaceEntry(page, "Creator");
  expect(
    await db.playthroughMembership.count({ where: { player: { accountId: account.accountId }, status: "COMPLETED" } }),
  ).toBeGreaterThan(0);
});

test("Journey N: Seamless Personal Harbor crossfade", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  await accountDestination(page, account, "Overview");
  const samples: Array<{ routeCount: number; interactive: string[]; hidden: string[]; opacities: string[] }> = [];
  for (const destination of ["Personal Information", "Preferences", "Public Profile", "Sessions & Devices"]) {
    const navigation = page.getByRole("navigation", { name: "Personal Harbor sections" });
    const link = navigation.getByRole("link", { name: destination, exact: true });
    const href = await link.getAttribute("href");
    if (!href) throw new Error(`${destination} has no href.`);
    await link.click({ noWaitAfter: true });
    for (let index = 0; index < 5; index += 1) {
      samples.push(await routeLayerSample(page));
      await page.waitForTimeout(30);
    }
    await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(href, page.url()).pathname);
    await expect(page.locator("[data-route-layer]").last().locator("h1")).toBeFocused();
  }
  expect(samples.some((sample) => sample.routeCount === 2)).toBe(true);
  expect(samples.some((sample) => sample.interactive.includes("false") && sample.hidden.includes("true"))).toBe(true);
  await writeMotionReceipt("HP-OWCR3-EV-R-PERSONAL-HARBOR-CROSSFADE", { samples });
  await capture(page, "HP-OWCR3-EV-R-PERSONAL-HARBOR-CROSSFADE", false);
});

test("Journey O: Seamless cross-product crossfade", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  await begin(page);
  const frames: Array<Record<string, unknown>> = [];
  const global = page.getByRole("navigation", { name: "Global navigation" });
  frames.push(...(await clickWithRouteSamples(page, global.getByRole("link", { name: "Community Harbor" }))));
  const chronicle = page.locator('a[href^="/community/"]').filter({ visible: true }).first();
  frames.push(...(await clickWithRouteSamples(page, chronicle)));
  const accountNavigation = await accountMenu(page, account.displayName);
  frames.push(...(await clickWithRouteSamples(page, accountNavigation.getByRole("link", { name: "Personal Harbor" }))));
  const workspacesMenu = await accountMenu(page, account.displayName);
  frames.push(...(await clickWithRouteSamples(page, workspacesMenu.getByRole("link", { name: "All Workspaces" }))));
  frames.push(...(await clickWithRouteSamples(page, page.getByRole("link", { name: "Enter Player" }))));
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  expect(frames.some((sample) => sample.routeCount === 2)).toBe(true);
  await expect(page.locator('[data-route-interactive="false"]')).toHaveCount(0);
  await writeMotionReceipt("HP-OWCR3-EV-S-CROSS-PRODUCT-CROSSFADE", { frames });
  await capture(page, "HP-OWCR3-EV-S-CROSS-PRODUCT-CROSSFADE", false);
});

test("Journey P: Slow transition and loading", async ({ page }) => {
  let intercepted = false;
  let navigationStarted = false;
  await page.route("**/community**", async (route) => {
    if (!navigationStarted) {
      await route.abort();
      return;
    }
    intercepted = true;
    await route.continue({
      headers: { ...route.request().headers(), "x-homeport-validation-delay-ms": "700" },
    });
  });
  await page.goto("/tales");
  await expect(page.getByRole("heading", { name: "Choose a Chronicle" })).toBeVisible();
  await expect(page.locator(".ui-loading-state")).toHaveCount(0);
  const link = page.getByRole("link", { name: "Community Harbor", exact: true }).first();
  navigationStarted = true;
  const navigationStartedAt = Date.now();
  await link.click({ noWaitAfter: true });
  await expect.poll(() => intercepted).toBe(true);
  await page.waitForTimeout(Math.max(0, 400 - (Date.now() - navigationStartedAt)));
  const outgoingSample = await routeLayerSample(page);
  expect(outgoingSample.paths, `route layers at ${Date.now() - navigationStartedAt} ms`).toContain("/tales");
  await page.waitForTimeout(Math.max(0, 550 - (Date.now() - navigationStartedAt)));
  const loadingSample = await page.locator("[data-route-layer]").evaluateAll((layers) =>
    layers.map((layer) => ({
      path: layer.getAttribute("data-route-layer"),
      text: layer.textContent?.slice(0, 160),
      asyncStates: [...layer.querySelectorAll("[data-async-state]")].map((state) =>
        state.getAttribute("data-async-state"),
      ),
    })),
  );
  expect(JSON.stringify(loadingSample), `loading layers at ${Date.now() - navigationStartedAt} ms`).toContain(
    "Opening Community Harbor",
  );
  expect(await backgroundIsVisible(page)).toBe(true);
  await capture(page, "HP-OWCR3-EV-T-DELAYED-LOADING-CROSSFADE", false);
  const sample = await routeLayerSample(page);
  await expect(page).toHaveURL(/\/community/u);
  await expect(page.getByRole("heading", { name: "Find your next bearing", exact: true })).toBeVisible();
  await writeMotionReceipt("HP-OWCR3-EV-T-DELAYED-LOADING-CROSSFADE", {
    governedDelayMs: 700,
    outgoingSample,
    loadingSample,
    sample,
  });
});

test("Journey Q: Account-menu visible motion", async ({ page }) => {
  const account = await signIn(page, "PROFILE_MEDIA_COMPLETE");
  const trigger = page.getByRole("button", { name: account.displayName, exact: true });
  await trigger.click();
  const menu = page.locator("#shell-account-disclosure");
  const opening = await sampleAnimation(menu, 7, 32);
  expect(new Set(opening.map((frame) => `${frame.opacity}:${frame.transform}:${frame.filter}`)).size).toBeGreaterThan(
    2,
  );
  await writeMotionReceipt("HP-OWCR3-EV-U-ACCOUNT-MENU-OPENING", { opening });
  await capture(page, "HP-OWCR3-EV-U-ACCOUNT-MENU-OPENING", false);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await capture(page, "HP-OWCR3-EV-V-ACCOUNT-MENU-OPEN", false);
  const closing = await sampleClosingAnimation(menu, 5, 28);
  await expect(menu).toHaveCount(0);
  expect(new Set(closing.map((frame) => `${frame.opacity}:${frame.transform}:${frame.filter}`)).size).toBeGreaterThan(
    1,
  );
  await writeMotionReceipt("HP-OWCR3-EV-W-ACCOUNT-MENU-CLOSING", { closing });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  const reduced = page.locator("#shell-account-disclosure");
  await expect(reduced).toHaveAttribute("data-account-menu-motion", "reduced");
  const reducedFrames = await sampleAnimation(reduced, 3, 30);
  expect(new Set(reducedFrames.map((frame) => `${frame.opacity}:${frame.transform}`)).size).toBeLessThanOrEqual(2);
  await capture(page, "HP-OWCR3-EV-AC-REDUCED-MOTION", false);
});

test("Journey R: Dark default", async ({ context, page }) => {
  const response = await page.request.get("/");
  expect(await response.text()).toMatch(/data-voyage-theme="dark"/u);
  await begin(page);
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  await capture(page, "HP-OWCR3-EV-X-DARK-FIRST-PAINT");

  const email = uniqueEmail("round3-dark-default");
  await openRegistration(page);
  await register(page, "Dark Default Account", email);
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await verifyCode(page, delivery.token!);
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator("html")).toHaveAttribute("data-voyage-theme", "dark");
  await second.close();
});

test("Journey S: Mobile imagery and verification", async ({ page }) => {
  const account = await signIn(page, "NO_PROFILE_MEDIA");
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-avatar-file").setInputFiles(media.validAvatar);
  const avatarDialog = page.getByRole("dialog", { name: "Position your avatar" });
  const frame = avatarDialog.getByLabel("avatar crop position");
  const box = await frame.boundingBox();
  if (!box) throw new Error("Mobile avatar crop frame has no bounds.");
  await frame.dispatchEvent("pointerdown", { pointerId: 1, clientX: box.x + 80, clientY: box.y + 80 });
  await frame.dispatchEvent("pointermove", { pointerId: 1, clientX: box.x + 110, clientY: box.y + 100 });
  await frame.dispatchEvent("pointerup", { pointerId: 1, clientX: box.x + 110, clientY: box.y + 100 });
  await capture(page, "HP-OWCR3-EV-Y-MOBILE-AVATAR-CROP");
  await avatarDialog.getByRole("button", { name: "Use this crop" }).click();
  await page
    .locator('[aria-label="Pending avatar actions"]')
    .getByRole("button", { name: "Save avatar image" })
    .click();
  await expect(page.getByText(/Image normalized and stored/u)).toBeVisible();
  await signOut(page, account);

  const email = uniqueEmail("round3-mobile");
  await openRegistration(page);
  await register(page, "Round Three Mobile", email);
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await capture(page, "HP-OWCR3-EV-Z-MOBILE-VERIFICATION");
  await verifyCode(page, delivery.token!);
  await accountMenu(page, "Round Three Mobile");
  await accountDestination(
    page,
    { accountId: delivery.accountId, email, displayName: "Round Three Mobile" },
    "All Workspaces",
  );
  await capture(page, "HP-OWCR3-EV-AA-MOBILE-WORKSPACES");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("Journey T: Effective 200 percent zoom", async ({ page }) => {
  const account = await signIn(page, "NO_PROFILE_MEDIA");
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-avatar-file").setInputFiles(media.validAvatar);
  const dialog = page.getByRole("dialog", { name: "Position your avatar" });
  await expect(dialog.getByRole("slider")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Use this crop" })).toBeVisible();
  await capture(page, "HP-OWCR3-EV-AB-ZOOM-CROP-EDITOR");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await accountDestination(page, account, "Overview");
  await expect(page.locator(".harbor-identity-hero")).toBeVisible();
  await accountDestination(page, account, "All Workspaces");
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  await accountMenu(page, account.displayName);
});

test("Journey U: Round 3 natural regression", async ({ page }) => {
  const email = uniqueEmail("round3-natural");
  await openRegistration(page);
  await register(page, "Round Three Natural", email);
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await verifyCode(page, delivery.token!);
  const account = { accountId: delivery.accountId, email, displayName: "Round Three Natural" };
  await accountDestination(page, account, "Public Profile");
  await page.locator("#profile-avatar-file").setInputFiles(media.validAvatar);
  await page
    .getByRole("dialog", { name: "Position your avatar" })
    .getByRole("button", { name: "Use this crop" })
    .click();
  await page
    .locator('[aria-label="Pending avatar actions"]')
    .getByRole("button", { name: "Save avatar image" })
    .click();
  await expect(page.getByText(/Image normalized and stored/u)).toBeVisible();
  await accountDestination(page, account, "Overview");
  await accountDestination(page, account, "All Workspaces");
  await settledLink(page, page.getByRole("link", { name: "Enter Captain" }));
  await accountDestination(page, account, "All Workspaces");
  await settledLink(page, page.getByRole("link", { name: "Enter Creator" }));
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Find your next bearing", exact: true })).toBeVisible();
  await accountDestination(page, account, "Personal Harbor");
  await signOut(page, account);
  await signInCredentials(page, account);
  await expect(page.getByRole("button", { name: account.displayName, exact: true }).locator("img")).toBeVisible();
  await capture(page, "HP-OWCR3-EV-AD-FULL-ROUND3-REGRESSION");
});

test("Journey V: Prior correction regression", async ({ page }) => {
  const receiptPath = path.join(taskRoot, "reports", "owner-correction-round3-journeys", "journey-V-regressions.json");
  expect(existsSync(receiptPath)).toBe(true);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, string>;
  expect(receipt.sourceSha).toBe(sourceSha);
  expect(receipt.correctionRound2).toBe("PASSED_A_W");
  expect(receipt.correctionRound1).toBe("PASSED_A_U_VIA_ROUND2_W");
  expect(receipt.originalPhase7).toBe("PASSED_A_O_VIA_ROUND2_W");
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
  if (!account) throw new Error(`Unknown Round 3 alias: ${alias}`);
  await signInCredentials(page, account);
  return account;
}

async function signInCredentials(page: Page, account: Alias) {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Sign In", exact: true }));
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
}

async function signInPending(page: Page, account: Alias) {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  await settledLink(page, menu.getByRole("link", { name: "Sign In", exact: true }));
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  await expect(page.locator('[data-route-interactive="false"]')).toHaveCount(0);
}

async function signOut(page: Page, account: Alias) {
  const menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
}

async function openRegistration(page: Page) {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  const create = menu.getByRole("link", { name: "Create Account", exact: true });
  await settledLink(page, create);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
}

async function register(page: Page, displayName: string, email: string) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(handoff.password);
  await page.getByLabel("Confirm password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  await expect(page.locator('[data-route-interactive="false"]')).toHaveCount(0);
}

async function verifyCode(page: Page, code: string) {
  const input = page.getByLabel("Code");
  await input.fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
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
    const mobileSections = page.locator("details.personal-harbor__mobile-sections");
    if (await mobileSections.isVisible()) {
      if ((await mobileSections.getAttribute("open")) === null) await mobileSections.locator("summary").click();
      link = mobileSections
        .getByRole("navigation", { name: "Personal Harbor sections" })
        .getByRole("link", { name: label, exact: true });
    } else {
      link = page
        .getByRole("navigation", { name: "Personal Harbor sections" })
        .getByRole("link", { name: label, exact: true });
    }
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
  await expect(page.locator('[data-route-interactive="false"]')).toHaveCount(0);
}

async function clickWithRouteSamples(page: Page, link: Locator) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Crossfade evidence link has no destination.");
  await link.click({ noWaitAfter: true });
  const frames: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 6; index += 1) {
    frames.push(await routeLayerSample(page));
    await page.waitForTimeout(30);
  }
  await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(href, page.url()).pathname);
  await expect(page.locator("main:visible").last()).toBeVisible();
  await expect(page.locator('[data-route-interactive="false"]')).toHaveCount(0);
  return frames;
}

async function expectWorkspaceEntry(page: Page, label: string) {
  const card = page.getByRole("heading", { name: label, exact: true }).locator("..");
  await expect(card.getByText("Available", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: `Enter ${label}` })).toBeVisible();
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
          .find((row) => row.purpose === purpose && row.email === email.toLocaleLowerCase("en-US"));
        return delivery?.token ?? delivery?.detail ?? null;
      },
      { timeout: 20_000, message: `${purpose} delivery for ${email}` },
    )
    .not.toBeNull();
  return delivery!;
}

function runReconciliation(accountId: string, flags: string[]) {
  const cli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(
    process.execPath,
    [cli, "scripts/homeport/reconcile-claimed-account-capabilities.ts", `--account-id=${accountId}`, ...flags],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}` },
      encoding: "utf8",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Reconciliation failed: ${result.stderr}`);
  return JSON.parse(result.stdout) as {
    mode: string;
    verified: boolean;
    accounts: Array<{ changed: boolean; status: string; ordinaryEntry: string; playerProfile: string }>;
  };
}

async function routeLayerSample(page: Page) {
  return page.locator("[data-route-layer]").evaluateAll((layers) => ({
    routeCount: layers.length,
    interactive: layers.map((layer) => layer.getAttribute("data-route-interactive") ?? "unset"),
    hidden: layers.map((layer) => layer.getAttribute("aria-hidden") ?? "false"),
    opacities: layers.map((layer) => getComputedStyle(layer).opacity),
    paths: layers.map((layer) => layer.getAttribute("data-route-layer")),
  }));
}

async function sampleAnimation(locator: Locator, count: number, intervalMs: number) {
  const frames: Array<{ opacity: string; transform: string; filter: string }> = [];
  for (let index = 0; index < count; index += 1) {
    frames.push(
      await locator.evaluate((node) => {
        const style = getComputedStyle(node);
        return { opacity: style.opacity, transform: style.transform, filter: style.filter };
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return frames;
}

async function sampleClosingAnimation(locator: Locator, count: number, intervalMs: number) {
  return locator.evaluate(
    async (node, options) => {
      const frames: Array<{ opacity: string; transform: string; filter: string }> = [];
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      for (let index = 0; index < options.count; index += 1) {
        const style = getComputedStyle(node);
        frames.push({ opacity: style.opacity, transform: style.transform, filter: style.filter });
        await new Promise((resolve) => window.setTimeout(resolve, options.intervalMs));
      }
      return frames;
    },
    { count, intervalMs },
  );
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function backgroundIsVisible(page: Page) {
  return page.locator("[data-route-layer]").evaluateAll((layers) =>
    layers.some((layer) => {
      const style = getComputedStyle(layer);
      const box = layer.getBoundingClientRect();
      return (
        Number.parseFloat(style.opacity || "0") > 0.05 &&
        box.width > 0 &&
        box.height > 0 &&
        Boolean(layer.textContent?.trim())
      );
    }),
  );
}

async function writeMotionReceipt(evidenceId: string, measurements: Record<string, unknown>) {
  const reportRoot = path.join(taskRoot, "reports", "owner-correction-round3-journeys");
  await mkdir(reportRoot, { recursive: true });
  await writeFile(
    path.join(reportRoot, `${evidenceId}-motion.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion: fixtureReceipt.fixtureVersion,
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
  const screenshotRoot = path.join(taskRoot, "screenshots", `round3-${journeyId}`);
  const reportRoot = path.join(taskRoot, "reports", "owner-correction-round3-journeys");
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });
  const screenshotPath = path.join(screenshotRoot, `${evidenceId}.png`);
  const image = await page.screenshot({ path: screenshotPath, fullPage, caret: "hide" });
  const theme = await page.locator("html").getAttribute("data-voyage-theme");
  const reducedMotion = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const browserVersion = page.context().browser()?.version() ?? "unavailable";
  await writeFile(
    path.join(reportRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        branch: "codex/project-homeport-product-reality-recovery",
        fixtureVersion: fixtureReceipt.fixtureVersion,
        databasePath,
        screenshotPath,
        screenshotSha256: createHash("sha256").update(image).digest("hex"),
        browser: `Playwright Chromium ${browserVersion}`,
        viewport: page.viewportSize(),
        route: new URL(page.url()).pathname,
        screen: evidenceId,
        accountAlias: evidenceAccountAlias(evidenceId),
        title: await page.title(),
        theme,
        motionMode: reducedMotion ? "REDUCED" : "FULL",
        timestamp: new Date().toISOString(),
        fileChecksum: createHash("sha256").update(image).digest("hex"),
        reviewClassification: "PENDING_CODEX_VISUAL_REVIEW",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${journeyId.toLocaleLowerCase("en-US")}@example.test`;
}

function evidenceAccountAlias(evidenceId: string) {
  if (/EV-(J|K|L|M|X|Z)-/u.test(evidenceId)) return "ANONYMOUS_OR_NEW_SYNTHETIC";
  if (/EV-(N|O|P|AA)-/u.test(evidenceId)) return "KGTESTING_NEW";
  if (/EV-Q-/u.test(evidenceId)) return "ACTIVE_PLAYER_LOCKED";
  if (/EV-(A|B|C|I|Y|AB)-/u.test(evidenceId)) return "NO_PROFILE_MEDIA";
  return "PROFILE_MEDIA_COMPLETE";
}

function maskedEmailPattern(email: string) {
  const [local, domain] = email.split("@");
  return new RegExp(`${escapeRegex(local[0] ?? "")}.*@${escapeRegex(domain ?? "")}`, "u");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

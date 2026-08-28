import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type Alias = { accountId: string; email: string; displayName: string };
type Delivery = { purpose: string; email: string; token?: string; accountId: string; detail?: string };
type TemporalLayer = {
  path: string | null;
  generation: number | null;
  role: string | null;
  interactive: boolean;
  contentHidden: boolean;
  opacity: number;
  visibility: string;
  visible: boolean;
  text: string;
  animationDurationsMs: number[];
};
type TemporalFrame = {
  tMs: number;
  urlPath: string;
  activeGeneration: number | null;
  state: string | null;
  loadingVisible: boolean;
  focusTarget: string;
  backgroundOnly: boolean;
  layers: TemporalLayer[];
};
type LoadingTransition = {
  tMs: number;
  visible: boolean;
};
type TemporalReceipt = {
  sourcePath: string;
  targetPath: string;
  initialGeneration: number | null;
  navigationStartedMs: number | null;
  destinationReadyMs: number | null;
  destinationSettledMs: number | null;
  firstLoadingMs: number | null;
  lastLoadingMs: number | null;
  loadingAppearances: number;
  loadingDisappearances: number;
  loadingTransitions: LoadingTransition[];
  transitionDurationMs: number | null;
  observedReadyToSettledMs: number | null;
  oldRouteReturnedAfterSettlement: boolean;
  frames: TemporalFrame[];
};

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_PATCH_A_JOURNEY_ID");
const sourceSha = required("HOMEPORT_PHASE7_PATCH_A_SOURCE_SHA");
const databasePath = path.resolve(required("HOMEPORT_PHASE7_PATCH_A_DATABASE_PATH"));
const fixtureVersion = "homeport-phase7-owner-correction-round3-patch-a-v1";
const outboxPath = path.join(taskRoot, "outbox", `patch-a-journey-${journeyId}.jsonl`);
const oneShotFailureMarker = `${outboxPath}.verify-email-failed-once`;
const handoff = JSON.parse(
  readFileSync(
    path.join(taskRoot, "credentials", "owner-correction-round3-walkthrough-credentials.private.json"),
    "utf8",
  ),
) as { fixtureVersion: string; password: string; accounts: Record<string, Alias> };
const fixtureReceipt = JSON.parse(
  readFileSync(path.join(taskRoot, "reports", "owner-correction-round3-fixture-prepare-receipt.json"), "utf8"),
) as { fixtureVersion: string; email: { providerStatus: string } };
const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  rmSync(outboxPath, { force: true });
  rmSync(oneShotFailureMarker, { force: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(handoff.fixtureVersion).toBe(fixtureVersion);
  expect(fixtureReceipt.fixtureVersion).toBe(fixtureVersion);
});
test.afterAll(async () => db.$disconnect());

test("Journey A: Fast auth-page navigation", async ({ page }) => {
  await begin(page);
  const menu = await accountMenu(page, "Account");
  const signIn = await sampleNavigation(
    page,
    () => menu.getByRole("link", { name: "Sign In", exact: true }).click({ noWaitAfter: true }),
    "/sign-in",
  );
  assertFastNavigation(signIn);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await capture(page, "HP-AUTH-PATCH-EV-A-SIGNIN", "ANONYMOUS");

  const signUp = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Create Account", exact: true }).click({ noWaitAfter: true }),
    "/register",
  );
  assertFastNavigation(signUp);
  await capture(page, "HP-AUTH-PATCH-EV-B-SIGNUP", "ANONYMOUS");

  const forgot = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Forgot Password", exact: true }).click({ noWaitAfter: true }),
    "/forgot-password",
  );
  assertFastNavigation(forgot);
  await capture(page, "HP-AUTH-PATCH-EV-C-FORGOT-PASSWORD", "ANONYMOUS");

  const returned = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Return to Sign In" }).click({ noWaitAfter: true }),
    "/sign-in",
  );
  assertFastNavigation(returned);
  await writeTemporalReceipt("HP-AUTH-PATCH-MOTION-A-FAST-NO-SPINNER", {
    navigations: [signIn, signUp, forgot, returned],
    thresholdMs: 500,
    observationThroughMs: 850,
  });
});

test("Journey B: Slow auth-page navigation", async ({ page }) => {
  let navigationStarted = false;
  await page.route("**/register**", async (route) => {
    if (!navigationStarted) {
      await route.abort();
      return;
    }
    await route.continue({
      headers: { ...route.request().headers(), "x-homeport-validation-delay-ms": "700" },
    });
  });
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  navigationStarted = true;
  const receipt = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Create Account", exact: true }).click({ noWaitAfter: true }),
    "/register",
    1_250,
  );
  expect(receipt.navigationStartedMs).not.toBeNull();
  expect(receipt.firstLoadingMs).not.toBeNull();
  expect(receipt.firstLoadingMs! - receipt.navigationStartedMs!).toBeGreaterThanOrEqual(480);
  expect(receipt.loadingAppearances).toBe(1);
  expect(receipt.loadingDisappearances).toBe(1);
  expect(receipt.destinationReadyMs).not.toBeNull();
  expect(receipt.lastLoadingMs!).toBeLessThan(receipt.destinationSettledMs!);
  expect(receipt.oldRouteReturnedAfterSettlement).toBe(false);
  expect(
    receipt.frames.some((frame) => frame.backgroundOnly),
    JSON.stringify(
      receipt.frames.filter((frame) => frame.backgroundOnly),
      null,
      2,
    ),
  ).toBe(false);
  const beforeThreshold = receipt.frames.filter(
    (frame) => frame.tMs - receipt.navigationStartedMs! >= 300 && frame.tMs - receipt.navigationStartedMs! < 480,
  );
  expect(
    beforeThreshold.some((frame) => frame.layers.some((layer) => layer.path === "/sign-in" && layer.visible)),
  ).toBe(true);
  await writeTemporalReceipt("HP-AUTH-PATCH-MOTION-B-SLOW-LOADING", { governedDelayMs: 700, receipt });
});

test("Journey C: Sign-in to Home", async ({ page }) => {
  const account = handoff.accounts.SERA_OWNER;
  await page.goto("/sign-in");
  await fillSignIn(page, account);
  const receipt = await sampleNavigation(
    page,
    () => page.getByRole("button", { name: "Continue" }).click({ noWaitAfter: true }),
    "/",
    1_000,
  );
  assertFastNavigation(receipt);
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify email" })).toHaveCount(0);
  expect(receipt.oldRouteReturnedAfterSettlement).toBe(false);
  await capture(page, "HP-AUTH-PATCH-EV-K-AUTHENTICATED-HOME", "SERA_OWNER");
  await writeTemporalReceipt("HP-AUTH-PATCH-MOTION-C-SIGNIN-TO-HOME", { receipt });
});

test("Journey D: Duplicate display name", async ({ page }) => {
  const existing = handoff.accounts.SERA_OWNER;
  const email = uniqueEmail("duplicate-display");
  const beforeAccounts = await db.userAccount.count();
  const beforeEmails = await db.accountEmail.count();
  await page.goto("/register");
  await fillRegistration(page, existing.displayName, email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/register/u);
  const displayName = page.getByLabel("Display name");
  await expect(displayName).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("That display name is already in use.", { exact: true })).toBeVisible();
  await expect(displayName).toBeFocused();
  expect(await db.userAccount.count()).toBe(beforeAccounts);
  expect(await db.accountEmail.count()).toBe(beforeEmails);
  expect(await db.accountEmail.count({ where: { normalizedEmail: email } })).toBe(0);
  await capture(page, "HP-AUTH-PATCH-EV-D-DUPLICATE-DISPLAY-NAME", "ANONYMOUS_NEW_SYNTHETIC");

  await displayName.fill(`Patch A Display ${journeyId}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  expect(await db.userAccount.count()).toBe(beforeAccounts + 1);
  expect(await db.accountEmail.count({ where: { normalizedEmail: email } })).toBe(1);
});

test("Journey E: Existing email", async ({ page }) => {
  const existing = handoff.accounts.SERA_OWNER;
  const beforeAccounts = await db.userAccount.count();
  const beforeEmail = await db.accountEmail.findUniqueOrThrow({
    where: { normalizedEmail: existing.email },
    select: { id: true, accountId: true, verificationState: true },
  });
  await page.goto("/register");
  await fillRegistration(page, `Patch A Existing Email ${journeyId}`, existing.email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-in\?.*reason=account-exists/u);
  await expect(page.getByLabel("Email or legacy Player name")).toHaveValue(existing.email);
  await expect(
    page.getByText("An account already uses this email address. Sign in instead.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot Password" })).toBeVisible();
  expect(await db.userAccount.count()).toBe(beforeAccounts);
  expect(
    await db.accountEmail.findUniqueOrThrow({
      where: { normalizedEmail: existing.email },
      select: { id: true, accountId: true, verificationState: true },
    }),
  ).toEqual(beforeEmail);
  await capture(page, "HP-AUTH-PATCH-EV-E-EXISTING-EMAIL-HANDOFF", "SERA_OWNER");
});

test("Journey F: Provider failure after creation", async ({ page }) => {
  const email = uniqueEmail("provider-failure");
  const beforeAccounts = await db.userAccount.count();
  await page.goto("/register");
  await fillRegistration(page, `Patch A Provider Failure ${journeyId}`, email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/verify-email\?.*delivery=failed/u);
  const deliveryFailure = page.getByRole("alert");
  await expect(
    deliveryFailure.getByText("Your account was created, but we could not send the verification email.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(deliveryFailure.locator("p")).toHaveCSS("color", "rgb(58, 60, 51)");
  await expect(page.getByText("Account registration unavailable.", { exact: true })).toHaveCount(0);
  const created = await db.accountEmail.findUniqueOrThrow({
    where: { normalizedEmail: email },
    include: { account: true },
  });
  expect(await db.userAccount.count()).toBe(beforeAccounts + 1);
  expect(created.account.status).toBe("PENDING_VERIFICATION");
  expect(await db.transactionalEmailDelivery.count({ where: { accountId: created.accountId, status: "FAILED" } })).toBe(
    1,
  );
  await capture(page, "HP-AUTH-PATCH-EV-H-PENDING-VERIFICATION", "NEW_PENDING_SYNTHETIC");

  await page.getByRole("button", { name: "Retry sending" }).click();
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  expect(delivery.token).toMatch(/^\d{6}$/u);
  expect(await db.userAccount.count()).toBe(beforeAccounts + 1);
  expect(await db.accountEmail.count({ where: { normalizedEmail: email } })).toBe(1);
  expect(
    await db.transactionalEmailDelivery.count({ where: { accountId: created.accountId, status: "SUBMITTED" } }),
  ).toBe(1);
});

test("Journey G: Password guidance", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(`Patch A Password ${journeyId}`);
  await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("password-guidance"));
  await page.getByLabel("Password", { exact: true }).fill("password1234");
  await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", "Too weak");
  await capture(page, "HP-AUTH-PATCH-EV-F-PASSWORD-WEAK", "ANONYMOUS_NEW_SYNTHETIC");

  await paste(page.getByLabel("Password", { exact: true }), handoff.password);
  await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute(
    "aria-valuetext",
    /Good|Strong/u,
  );
  await page.getByLabel("Confirm password").fill(`${handoff.password}x`);
  await expect(page.getByText("Passwords do not match.", { exact: true })).toBeVisible();
  await paste(page.getByLabel("Confirm password"), handoff.password);
  await expect(page.getByText("Passwords match.", { exact: true })).toBeVisible();
  await capture(page, "HP-AUTH-PATCH-EV-G-PASSWORD-STRONG-MATCH", "ANONYMOUS_NEW_SYNTHETIC");
});

test("Journey H: Existing unverified account sign-in", async ({ page }) => {
  const account = handoff.accounts.PENDING_VERIFICATION;
  const legacyPlayerName = `pending-${journeyId.toLocaleLowerCase("en-US")}`;
  await db.playerProfile.update({
    where: { accountId: account.accountId },
    data: { username: legacyPlayerName },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email or legacy Player name").fill(legacyPlayerName.toLocaleUpperCase("en-US"));
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { name: "Verify email" })).toHaveCount(0);
  const notice = page.getByRole("complementary", { name: "Email verification" });
  await expect(notice.getByText("Verify your email when you are ready.")).toBeVisible();
  await expect(notice.getByRole("button", { name: "Resend verification" })).toBeVisible();
  await expect(notice.getByRole("link", { name: "Change email" })).toBeVisible();
  const [headerBox, noticeBox] = await Promise.all([
    page.locator(".product-shell-header").boundingBox(),
    notice.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(noticeBox).not.toBeNull();
  expect(noticeBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
  await capture(page, "HP-AUTH-PATCH-EV-I-UNVERIFIED-USERNAME-SIGNED-IN", "PENDING_VERIFICATION");

  let menu = await accountMenu(page, account.displayName);
  await menu.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.goto("/sign-in");
  await page.getByLabel("Email or legacy Player name").fill(account.email.toLocaleUpperCase("en-US"));
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { name: "Verify email" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Email verification" })).toBeVisible();
  await capture(page, "HP-AUTH-PATCH-EV-I-UNVERIFIED-EMAIL-SIGNED-IN", "PENDING_VERIFICATION");

  menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "Personal Harbor", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("heading", { name: account.displayName })).toBeVisible();
});

test("Journey I: Verification registration", async ({ page }) => {
  const email = uniqueEmail("verification-registration");
  const displayName = `Patch A Verification ${journeyId}`;
  await page.goto("/register");
  await fillRegistration(page, displayName, email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await capture(page, "HP-AUTH-PATCH-EV-J-VERIFICATION-CODE", "NEW_PENDING_SYNTHETIC");
  await page.getByLabel("Code").fill(delivery.token!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: displayName, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify email" })).toHaveCount(0);
  await capture(page, "HP-AUTH-PATCH-EV-K-AUTHENTICATED-HOME", "NEW_VERIFIED_SYNTHETIC");
  expect(process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER).toBe("TASK_OWNED_TEST");
});

test("Journey J: Interrupted navigation", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/sign-in");
  const startedAt = Date.now();
  const frames: TemporalFrame[] = [await temporalFrame(page, 0)];
  const initialGeneration = frames[0].activeGeneration ?? 0;
  await page.getByRole("link", { name: "Create Account", exact: true }).evaluate((node: HTMLElement) => node.click());
  const registerGeneration = await waitForNewGeneration(page, initialGeneration, startedAt, frames);
  await page.getByRole("link", { name: "Safe return", exact: true }).evaluate((node: HTMLElement) => node.click());
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000, intervals: [25, 50] }).toBe("/");
  const homeGeneration = await waitForNewGeneration(page, registerGeneration, startedAt, frames);
  await page.getByRole("button", { name: "Account", exact: true }).evaluate((node: HTMLElement) => node.click());
  await expect(page.locator("#shell-account-disclosure")).toBeVisible({ timeout: 5_000 });
  await page
    .locator('#shell-account-disclosure a[href="/forgot-password"]')
    .evaluate((node: HTMLElement) => node.click());
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 10_000, intervals: [25, 50] })
    .toBe("/forgot-password");
  await waitForNewGeneration(page, homeGeneration, startedAt, frames);
  for (let index = 0; index < 38; index += 1) {
    await page.waitForTimeout(25);
    frames.push(await temporalFrame(page, Date.now() - startedAt));
  }
  await expect(page).toHaveURL(/\/forgot-password$/u, { timeout: 5_000 });
  await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[data-route-layer]")).toHaveCount(1, { timeout: 5_000 });
  expect(frames.some((frame) => frame.loadingVisible)).toBe(false);
  const generations = [...new Set(frames.map((frame) => frame.activeGeneration).filter((value) => value !== null))];
  expect(generations.length).toBeGreaterThanOrEqual(3);
  const settledIndex = frames.findIndex(
    (frame) => frame.state === "settled" && frame.layers.some((layer) => layer.path === "/forgot-password"),
  );
  expect(settledIndex).toBeGreaterThanOrEqual(0);
  expect(
    frames
      .slice(settledIndex)
      .some((frame) => frame.layers.some((layer) => layer.path !== "/forgot-password" && layer.visible)),
  ).toBe(false);
  await writeTemporalReceipt("HP-AUTH-PATCH-MOTION-D-INTERRUPTED-NAV", { frames, generations });
});

test("Journey K: Back and Forward", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create Account", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/u);
  await page.getByRole("link", { name: "Forgot Password", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/u);
  await page.getByRole("link", { name: "Return to Sign In" }).click();
  await expect(page).toHaveURL(/\/sign-in$/u);

  const backToForgot = await sampleNavigation(
    page,
    () => page.goBack({ waitUntil: "commit" }).then(() => undefined),
    "/forgot-password",
  );
  const backToRegister = await sampleNavigation(
    page,
    () => page.goBack({ waitUntil: "commit" }).then(() => undefined),
    "/register",
  );
  const forwardToForgot = await sampleNavigation(
    page,
    () => page.goForward({ waitUntil: "commit" }).then(() => undefined),
    "/forgot-password",
  );
  const forwardToSignIn = await sampleNavigation(
    page,
    () => page.goForward({ waitUntil: "commit" }).then(() => undefined),
    "/sign-in",
  );
  for (const receipt of [backToForgot, backToRegister, forwardToForgot, forwardToSignIn]) {
    assertFastNavigation(receipt);
    expect(receipt.frames.every((frame) => frame.layers.length <= 2)).toBe(true);
  }
  await writeTemporalReceipt("HP-AUTH-PATCH-MOTION-E-BACK-FORWARD", {
    navigations: [backToForgot, backToRegister, forwardToForgot, forwardToSignIn],
  });
});

test("Journey L: Mobile", async ({ page }) => {
  const existing = handoff.accounts.SERA_OWNER;
  const email = uniqueEmail("mobile-registration");
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("link", { name: "Create Account", exact: true }).click();
  await fillRegistration(page, existing.displayName, email);
  await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute(
    "aria-valuetext",
    /Good|Strong/u,
  );
  await expect(page.getByText("Passwords match.", { exact: true })).toBeVisible();
  await capture(page, "HP-AUTH-PATCH-EV-L-MOBILE-SIGNUP", "ANONYMOUS_NEW_SYNTHETIC");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That display name is already in use.", { exact: true })).toBeVisible();
  await page.getByLabel("Display name").fill(`Patch A Mobile ${journeyId}`);
  await page.getByRole("button", { name: "Continue" }).click();
  const delivery = await waitForDelivery("VERIFY_EMAIL", email);
  await page.getByLabel("Code").fill(delivery.token!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: `Patch A Mobile ${journeyId}`, exact: true })).toBeVisible();
});

test("Journey M: Reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-in");
  await expect(page.locator('[data-route-layer="/sign-in"]')).toHaveCSS("opacity", "1");
  const signUp = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Create Account", exact: true }).click({ noWaitAfter: true }),
    "/register",
    850,
  );
  const forgot = await sampleNavigation(
    page,
    () => page.getByRole("link", { name: "Forgot Password", exact: true }).click({ noWaitAfter: true }),
    "/forgot-password",
    850,
  );
  for (const receipt of [signUp, forgot]) {
    expect(receipt.frames.some((frame) => frame.loadingVisible)).toBe(false);
    expect(receipt.frames.every((frame) => frame.layers.length === 1)).toBe(true);
    expect(receipt.oldRouteReturnedAfterSettlement).toBe(false);
  }
  const translucentFrames = [...signUp.frames, ...forgot.frames].filter((frame) =>
    frame.layers.some((layer) => layer.opacity < 0.99),
  );
  expect(
    [...signUp.frames, ...forgot.frames].every((frame) => frame.layers.every((layer) => layer.opacity >= 0.99)),
    JSON.stringify(translucentFrames, null, 2),
  ).toBe(true);
});

test("Journey N: Owner blocking regression", async ({ page }) => {
  const account = handoff.accounts.SERA_OWNER;
  await signIn(page, account);
  const initialContext = await currentUserContext(page);
  expect(initialContext).toMatchObject({
    status: "authenticated",
    user: { accountId: "hp7c-account-full-capability" },
    capabilities: { canUsePlayer: true, canUseCaptain: true, canUseCreator: true },
  });
  const accountId = initialContext.user.accountId;
  const sessionId = initialContext.session.id;
  let menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "Personal Harbor", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("heading", { name: account.displayName })).toBeVisible();

  menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "All Workspaces", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  for (const workspace of ["Player", "Captain", "Creator"]) {
    const card = page.getByRole("heading", { name: workspace, exact: true }).locator("..");
    await expect(card.getByText("Available", { exact: true })).toBeVisible();
    await expect(card.getByRole("link", { name: `Enter ${workspace}` })).toBeVisible();
  }
  await capture(page, "HP-AUTH-PATCH-EV-M-OWNER-ACCESS-RESTORED", "SERA_OWNER");

  await page.getByRole("link", { name: "Enter Player" }).click();
  await expect(page).toHaveURL(/\/player\/library$/u);
  await expect(page.getByText(/Permission required|Sign in to continue/u)).toHaveCount(0);

  menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "All Workspaces", exact: true }).click();
  await page.getByRole("link", { name: "Enter Captain" }).click();
  await expect(page).toHaveURL(/\/captain\/library$/u);
  await expect(page.getByRole("heading", { name: "Captain's Console" })).toBeVisible();
  await expect(page.getByText(/sign in as Captain|Captain sign-in required/u)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No Captain Voyages yet" })).toBeVisible();
  await page.getByRole("button", { name: "Invitations", exact: false }).click();
  await expect(page.getByRole("heading", { name: "No Crew invitations yet" })).toBeVisible();

  await page.getByRole("button", { name: "Create a Voyage" }).first().click();
  await expect(page.getByRole("dialog", { name: "Select Chronicle" })).toBeVisible();
  const wizard = page.locator(".voyage-wizard");
  await wizard.locator(".wizard-choice-grid > button").first().click();
  await wizard.getByRole("button", { name: "Continue to Configure Voyage" }).click();
  await wizard.getByLabel("Voyage name").fill(`Canonical Captain ${journeyId}`);
  await wizard.getByRole("button", { name: "Continue to Add Crew" }).click();
  await wizard.getByLabel("Crew member name").fill(`Canonical Crew ${journeyId}`);
  await wizard.getByRole("button", { name: "Continue to Invitation access" }).click();
  await wizard.getByRole("button", { name: "Continue to Delivery" }).click();
  await wizard.getByRole("button", { name: "Continue to Review" }).click();
  await wizard.getByRole("button", { name: "Create Voyage and invitations" }).click();
  await expect(wizard.getByRole("heading", { name: `Canonical Crew ${journeyId}` })).toBeVisible();
  await wizard.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Invitations", exact: false }).click();
  await expect(page.getByRole("table", { name: "Crew invitations for Voyages" })).toBeVisible();
  await page.getByRole("button", { name: "Extend" }).first().click();
  await expect(page.getByText(/invitation .* was extended/u)).toBeVisible();

  const ownedVoyage = await db.taleSession.findFirstOrThrow({
    where: { captainAccountId: accountId, voyageName: `Canonical Captain ${journeyId}` },
    select: { id: true, captainAccountId: true },
  });
  expect(ownedVoyage.captainAccountId).toBe(accountId);
  const foreignVoyage = await db.taleSession.findFirst({
    where: { previewMode: false, captainAccountId: { not: null }, NOT: { captainAccountId: accountId } },
    select: { id: true },
  });
  if (foreignVoyage) {
    const status = await page.evaluate(
      async (id) => (await fetch(`/api/captain/sessions/${id}`)).status,
      foreignVoyage.id,
    );
    expect(status).toBe(403);
  }

  menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "All Workspaces", exact: true }).click();
  await page.getByRole("link", { name: "Enter Creator" }).click();
  await expect(page).toHaveURL(/\/studio\/library$/u);
  await expect(page.getByText(/sign in as Creator|Creator sign-in required/u)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No Chronicles yet" })).toBeVisible();
  await page.getByRole("link", { name: "Create Chronicle" }).first().click();
  await expect(page).toHaveURL(/\/studio\/tales\/new$/u);
  const chronicleTitle = `Canonical Creator ${journeyId}`;
  await page.getByLabel("Title", { exact: true }).fill(chronicleTitle);
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page).toHaveURL(/\/studio\/tales\/[a-z0-9-]+$/u);
  await expect(page.getByText(chronicleTitle, { exact: true }).first()).toBeVisible();
  const ownedChronicle = await db.chronicle.findFirstOrThrow({
    where: { title: chronicleTitle },
    select: { id: true, creatorAccountId: true },
  });
  expect(ownedChronicle.creatorAccountId).toBe(accountId);
  const foreignChronicle = await db.chronicle.findFirstOrThrow({
    where: { NOT: { id: ownedChronicle.id }, creatorAccountId: { not: accountId } },
    select: { id: true },
  });
  expect(await page.evaluate(async (id) => (await fetch(`/api/studio/tales/${id}`)).status, foreignChronicle.id)).toBe(
    404,
  );

  menu = await accountMenu(page, account.displayName);
  await menu.getByRole("link", { name: "All Workspaces", exact: true }).click();
  await page.getByRole("link", { name: "Enter Captain" }).click();
  await expect(page.getByText(`Canonical Captain ${journeyId}`, { exact: true })).toBeVisible();
  const finalContext = await currentUserContext(page);
  expect(finalContext.user.accountId).toBe(accountId);
  expect(finalContext.session.id).toBe(sessionId);
  expect(finalContext.capabilities).toMatchObject({ canUsePlayer: true, canUseCaptain: true, canUseCreator: true });
  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name === "wayfarer_account")).toHaveLength(1);
  expect(cookies.some((cookie) => ["forever_gm", "chronicle_player"].includes(cookie.name))).toBe(false);
});

async function begin(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator("main:visible").last()).toBeVisible();
}

async function accountMenu(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  const menu = page.locator("#shell-account-disclosure");
  await expect(menu).toBeVisible();
  return menu;
}

async function fillRegistration(page: Page, displayName: string, email: string) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(handoff.password);
  await page.getByLabel("Confirm password").fill(handoff.password);
}

async function fillSignIn(page: Page, account: Alias) {
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
}

async function signIn(page: Page, account: Alias) {
  await page.goto("/sign-in");
  await fillSignIn(page, account);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: account.displayName, exact: true })).toBeVisible();
}

async function currentUserContext(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/context", { cache: "no-store" });
    if (!response.ok) throw new Error(`Account context failed with ${response.status}.`);
    return response.json();
  }) as Promise<{
    status: string;
    user: { accountId: string };
    session: { id: string };
    capabilities: { canUsePlayer: boolean; canUseCaptain: boolean; canUseCreator: boolean };
  }>;
}

async function paste(locator: Locator, value: string) {
  await locator.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, nextValue);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: nextValue }));
  }, value);
  await expect(locator).toHaveValue(value);
}

async function waitForDelivery(purpose: string, email: string) {
  let delivery: Delivery | undefined;
  await expect
    .poll(
      () => {
        if (!existsSync(outboxPath)) return null;
        delivery = readFileSync(outboxPath, "utf8")
          .trim()
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Delivery)
          .find((row) => row.purpose === purpose && row.email === email.toLocaleLowerCase("en-US"));
        return delivery?.token ?? delivery?.detail ?? null;
      },
      { timeout: 20_000, message: `${purpose} synthetic task-owned delivery` },
    )
    .not.toBeNull();
  return delivery!;
}

async function sampleNavigation(
  page: Page,
  action: () => Promise<unknown>,
  targetPath: string,
  observeAfterNavigationMs = 850,
): Promise<TemporalReceipt> {
  const startedAt = Date.now();
  const initial = await temporalFrame(page, 0);
  const frames = [initial];
  await beginLoadingObservation(page, startedAt);
  await action();
  let navigationStartedMs: number | null = null;
  let destinationReadyMs: number | null = null;
  let destinationSettledMs: number | null = null;
  const hardDeadline = startedAt + 8_000;
  while (Date.now() < hardDeadline) {
    const elapsed = Date.now() - startedAt;
    const frame = await temporalFrame(page, elapsed);
    frames.push(frame);
    if (
      navigationStartedMs === null &&
      (frame.activeGeneration !== initial.activeGeneration || frame.urlPath === targetPath)
    )
      navigationStartedMs = elapsed;
    const destination = frame.layers.find((layer) => layer.path === targetPath);
    const destinationIsSettled =
      frame.urlPath === targetPath &&
      frame.state === "settled" &&
      frame.layers.length === 1 &&
      Boolean(destination?.visible);
    if (
      destinationReadyMs === null &&
      ((destination?.interactive && !destination.contentHidden) || destinationIsSettled)
    )
      destinationReadyMs = elapsed;
    if (destinationSettledMs === null && destinationIsSettled) destinationSettledMs = elapsed;
    if (
      navigationStartedMs !== null &&
      destinationSettledMs !== null &&
      elapsed >= navigationStartedMs + observeAfterNavigationMs
    )
      break;
    await page.waitForTimeout(25);
  }
  expect(navigationStartedMs, `navigation generation for ${targetPath}`).not.toBeNull();
  expect(destinationReadyMs, `ready destination ${targetPath}`).not.toBeNull();
  expect(destinationSettledMs, `settled destination ${targetPath}`).not.toBeNull();
  const loadingTransitions = await endLoadingObservation(page);
  const loadingFrames = frames.filter((frame) => frame.loadingVisible);
  const animationDurations = frames.flatMap((frame) => frame.layers.flatMap((layer) => layer.animationDurationsMs));
  let sampledLoadingAppearances = 0;
  let sampledLoadingDisappearances = 0;
  for (let index = 1; index < frames.length; index += 1) {
    if (!frames[index - 1].loadingVisible && frames[index].loadingVisible) sampledLoadingAppearances += 1;
    if (frames[index - 1].loadingVisible && !frames[index].loadingVisible) sampledLoadingDisappearances += 1;
  }
  const observedLoadingAppearances = loadingTransitions.filter((transition) => transition.visible).length;
  const observedLoadingDisappearances = loadingTransitions.filter((transition) => !transition.visible).length;
  const observedLoadingFrames = loadingTransitions.filter((transition) => transition.visible);
  return {
    sourcePath: initial.urlPath,
    targetPath,
    initialGeneration: initial.activeGeneration,
    navigationStartedMs,
    destinationReadyMs,
    destinationSettledMs,
    firstLoadingMs: observedLoadingFrames[0]?.tMs ?? loadingFrames[0]?.tMs ?? null,
    lastLoadingMs: observedLoadingFrames.at(-1)?.tMs ?? loadingFrames.at(-1)?.tMs ?? null,
    loadingAppearances: observedLoadingAppearances || sampledLoadingAppearances,
    loadingDisappearances: observedLoadingDisappearances || sampledLoadingDisappearances,
    loadingTransitions,
    transitionDurationMs: animationDurations.length ? Math.max(...animationDurations) : null,
    observedReadyToSettledMs: destinationSettledMs! - destinationReadyMs!,
    oldRouteReturnedAfterSettlement: frames
      .filter((frame) => frame.tMs >= destinationSettledMs!)
      .some((frame) => frame.layers.some((layer) => layer.path !== targetPath && layer.visible)),
    frames,
  };
}

async function beginLoadingObservation(page: Page, startedAt: number) {
  await page.evaluate((observationStartedAt) => {
    const key = "__homeportPhase7PatchALoadingObservation";
    type Observation = {
      observer: MutationObserver;
      visible: boolean;
      transitions: LoadingTransition[];
      observe: () => void;
    };
    const windowWithObservation = window as unknown as { [key: string]: Observation | undefined };
    const loadingVisible = () =>
      [...document.querySelectorAll<HTMLElement>(".ui-loading-state")].some((loading) => {
        const style = getComputedStyle(loading);
        const box = loading.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity || "1") > 0.02 &&
          box.width > 0 &&
          box.height > 0
        );
      });
    const observation = {} as Observation;
    observation.visible = loadingVisible();
    observation.transitions = [];
    observation.observe = () => {
      const visible = loadingVisible();
      if (visible === observation.visible) return;
      observation.visible = visible;
      observation.transitions.push({ tMs: Date.now() - observationStartedAt, visible });
    };
    observation.observer = new MutationObserver(observation.observe);
    observation.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "data-async-state", "style"],
      childList: true,
      subtree: true,
    });
    windowWithObservation[key] = observation;
  }, startedAt);
}

async function endLoadingObservation(page: Page): Promise<LoadingTransition[]> {
  return page.evaluate(() => {
    const key = "__homeportPhase7PatchALoadingObservation";
    type Observation = {
      observer: MutationObserver;
      transitions: LoadingTransition[];
      observe: () => void;
    };
    const windowWithObservation = window as unknown as { [key: string]: Observation | undefined };
    const observation = windowWithObservation[key];
    if (!observation) return [];
    observation.observe();
    observation.observer.disconnect();
    delete windowWithObservation[key];
    return observation.transitions;
  });
}

async function waitForNewGeneration(
  page: Page,
  previousGeneration: number,
  startedAt: number,
  frames: TemporalFrame[],
) {
  let nextGeneration = previousGeneration;
  await expect
    .poll(
      async () => {
        const frame = await temporalFrame(page, Date.now() - startedAt);
        frames.push(frame);
        nextGeneration = frame.activeGeneration ?? previousGeneration;
        return nextGeneration;
      },
      { timeout: 10_000, intervals: [20, 30, 50], message: `generation after ${previousGeneration}` },
    )
    .toBeGreaterThan(previousGeneration);
  return nextGeneration;
}

function assertFastNavigation(receipt: TemporalReceipt) {
  expect(receipt.navigationStartedMs).not.toBeNull();
  expect(receipt.destinationReadyMs).not.toBeNull();
  expect(receipt.destinationReadyMs! - receipt.navigationStartedMs!).toBeLessThan(500);
  expect(receipt.firstLoadingMs).toBeNull();
  expect(receipt.loadingAppearances).toBe(0);
  expect(
    receipt.frames.some((frame) => frame.backgroundOnly),
    JSON.stringify(
      receipt.frames.filter((frame) => frame.backgroundOnly),
      null,
      2,
    ),
  ).toBe(false);
  expect(receipt.oldRouteReturnedAfterSettlement).toBe(false);
  if (receipt.transitionDurationMs) {
    expect(receipt.transitionDurationMs).toBeGreaterThanOrEqual(200);
    expect(receipt.transitionDurationMs).toBeLessThanOrEqual(380);
  }
}

async function temporalFrame(page: Page, tMs: number): Promise<TemporalFrame> {
  return page.evaluate((elapsed) => {
    const transition = document.querySelector<HTMLElement>("[data-route-active-generation]");
    const layers = [...document.querySelectorAll<HTMLElement>("[data-route-layer]")].map((layer) => {
      const style = getComputedStyle(layer);
      const box = layer.getBoundingClientRect();
      const opacity = Number.parseFloat(style.opacity || "0");
      const text = (layer.textContent ?? "").replaceAll(/\s+/gu, " ").trim().slice(0, 180);
      return {
        path: layer.getAttribute("data-route-layer"),
        generation: Number.isFinite(Number(layer.getAttribute("data-route-generation")))
          ? Number(layer.getAttribute("data-route-generation"))
          : null,
        role: layer.getAttribute("data-route-role"),
        interactive: layer.getAttribute("data-route-interactive") === "true",
        contentHidden:
          layer.querySelector<HTMLElement>("[data-route-content]")?.getAttribute("data-route-content-hidden") ===
          "true",
        opacity,
        visibility: style.visibility,
        visible: opacity > 0.02 && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && Boolean(text),
        text,
        animationDurationsMs: layer
          .getAnimations()
          .map((animation) => Number(animation.effect?.getTiming().duration))
          .filter(Number.isFinite),
      };
    });
    const loadingVisible = [...document.querySelectorAll<HTMLElement>(".ui-loading-state")].some((loading) => {
      const style = getComputedStyle(loading);
      const box = loading.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0.02 &&
        box.width > 0 &&
        box.height > 0
      );
    });
    const active = document.activeElement as HTMLElement | null;
    const focusTarget = active
      ? `${active.tagName.toLocaleLowerCase("en-US")}${active.id ? `#${active.id}` : ""}:${(active.textContent ?? active.getAttribute("aria-label") ?? "").trim().slice(0, 80)}`
      : "none";
    return {
      tMs: elapsed,
      urlPath: window.location.pathname,
      activeGeneration: transition ? Number(transition.dataset.routeActiveGeneration) : null,
      state:
        transition?.dataset.routeState ??
        document.querySelector<HTMLElement>("[data-route-state]")?.dataset.routeState ??
        null,
      loadingVisible,
      focusTarget,
      backgroundOnly: layers.length > 0 && !layers.some((layer) => layer.visible),
      layers,
    };
  }, tMs);
}

async function writeTemporalReceipt(evidenceId: string, measurements: Record<string, unknown>) {
  const reportRoot = path.join(taskRoot, "evidence", "temporal");
  await mkdir(reportRoot, { recursive: true });
  await writeFile(
    path.join(reportRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        fixtureVersion,
        databasePath,
        transitionDurationMs: 280,
        loadingThresholdMs: 500,
        measurementKind: "BOUNDED_COMPUTED_FRAME_SEQUENCE",
        measurements,
        recordedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function capture(page: Page, evidenceId: string, accountAlias: string) {
  const screenshotRoot = path.join(taskRoot, "evidence", "screenshots", journeyId);
  const metadataRoot = path.join(taskRoot, "evidence", "metadata");
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(metadataRoot, { recursive: true });
  const screenshotPath = path.join(screenshotRoot, `${evidenceId}.png`);
  const image = await page.screenshot({ path: screenshotPath, fullPage: true, caret: "hide" });
  const checksum = createHash("sha256").update(image).digest("hex");
  await writeFile(
    path.join(metadataRoot, `${evidenceId}.json`),
    `${JSON.stringify(
      {
        evidenceId,
        journeyId,
        sourceSha,
        branch: "codex/project-homeport-product-reality-recovery",
        fixtureVersion,
        databasePath,
        screenshotPath,
        screenshotSha256: checksum,
        browser: `Playwright Chromium ${page.context().browser()?.version() ?? "unavailable"}`,
        viewport: page.viewportSize(),
        route: new URL(page.url()).pathname,
        accountAlias,
        title: await page.title(),
        theme: await page.locator("html").getAttribute("data-voyage-theme"),
        reducedMotion: await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        recordedAt: new Date().toISOString(),
        reviewClassification: "TASK_OWNED_SYNTHETIC_BROWSER_EVIDENCE",
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

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

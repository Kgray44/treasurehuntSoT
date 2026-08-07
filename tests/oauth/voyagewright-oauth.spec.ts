import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

type CurrentUser = {
  status: string;
  authenticated: boolean;
  user?: { accountId: string; displayName: string };
  csrfToken?: string;
  emailVerification?: { status: string };
};

const databaseUrl = process.env.VOYAGEWRIGHT_OAUTH_VALIDATION_DATABASE_URL;
if (!databaseUrl) throw new Error("OAuth validation database URL is missing.");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

async function currentUser(page: Page) {
  return page.evaluate(
    async () => (await fetch("/api/auth/context", { cache: "no-store" })).json() as Promise<CurrentUser>,
  );
}

async function signOut(page: Page) {
  const context = await currentUser(page);
  await page.evaluate(async (csrfToken) => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
    });
    sessionStorage.removeItem("wayfarer-csrf");
  }, context.csrfToken);
  await page.goto("/");
  await expect.poll(async () => (await currentUser(page)).authenticated).toBe(false);
}

async function chooseProvider(page: Page, mode: "register" | "sign-in", provider: "Google" | "GitHub") {
  await page.goto(`/${mode}?returnTo=/passport`);
  const label = mode === "register" ? `Create account with ${provider}` : `Continue with ${provider}`;
  await expect(page.getByRole("link", { name: label })).toBeVisible();
  await page.getByRole("link", { name: label }).click();
  await expect(page).toHaveURL(/\/passport\?signedInWith=(google|github)/u);
  return currentUser(page);
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("Google and GitHub use one canonical account, identity, and session lifecycle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The complete stateful lifecycle runs once on desktop Chromium.");
  const googleCreated = await chooseProvider(page, "register", "Google");
  expect(googleCreated).toMatchObject({ authenticated: true, status: "authenticated" });
  expect(googleCreated.emailVerification?.status).toBe("verified");
  const googleAccountId = googleCreated.user!.accountId;
  const googleAccount = await prisma.userAccount.findUnique({
    where: { id: googleAccountId },
    include: { emails: true, credential: true, externalIdentities: true, sessions: true },
  });
  expect(googleAccount).toMatchObject({ status: "ACTIVE", credential: null });
  expect(googleAccount?.emails).toEqual([
    expect.objectContaining({ verificationState: "VERIFIED", verifiedAt: expect.any(Date) }),
  ]);
  expect(googleAccount?.externalIdentities).toEqual([
    expect.objectContaining({ provider: "GOOGLE", useForLogin: true, encryptedToken: null }),
  ]);
  expect(googleAccount?.sessions.length).toBeGreaterThanOrEqual(1);

  await page.reload();
  expect((await currentUser(page)).user?.accountId).toBe(googleAccountId);
  const secondTab = await page.context().newPage();
  await secondTab.goto(new URL("/passport", page.url()).toString());
  expect((await currentUser(secondTab)).user?.accountId).toBe(googleAccountId);
  await secondTab.close();
  await signOut(page);
  const googleReturned = await chooseProvider(page, "sign-in", "Google");
  expect(googleReturned.user?.accountId).toBe(googleAccountId);
  expect(await prisma.userAccount.count()).toBe(1);
  await signOut(page);

  const githubCreated = await chooseProvider(page, "register", "GitHub");
  const githubAccountId = githubCreated.user!.accountId;
  expect(githubAccountId).not.toBe(googleAccountId);
  const githubIdentity = await prisma.externalIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "GITHUB", providerAccountId: "github-synthetic-001" } },
  });
  expect(githubIdentity).toMatchObject({ accountId: githubAccountId, useForLogin: true, encryptedToken: null });
  await signOut(page);
  const githubReturned = await chooseProvider(page, "sign-in", "GitHub");
  expect(githubReturned.user?.accountId).toBe(githubAccountId);
  expect(await prisma.userAccount.count()).toBe(2);
  await signOut(page);

  const passwordEmail = "password.owner@example.test";
  await page.goto("/register?returnTo=/passport");
  await expect(page.getByRole("link", { name: "Create account with Google" })).toBeVisible();
  await page.getByLabel("Display name").fill("Password Owner");
  await page.getByLabel("Email").fill(passwordEmail);
  await page.getByLabel("Password", { exact: true }).fill("Harbor!Compass9River");
  await page.getByLabel("Confirm password").fill("Harbor!Compass9River");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/auth/register")),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  await expect(page).toHaveURL(/\/verify-email/u);
  await signOut(page);
  await page.goto("/sign-in?returnTo=/passport");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  await page.getByLabel("Email or legacy Player name").fill(passwordEmail);
  await page.getByLabel("Password").fill("Harbor!Compass9River");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-in")),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/passport");
  await expect.poll(async () => (await currentUser(page)).authenticated).toBe(true);
  const passwordContext = await currentUser(page);
  const passwordAccountId = passwordContext.user!.accountId;
  expect(passwordContext.emailVerification?.status).toBe("unverified");
  expect((await prisma.userAccount.findUnique({ where: { id: passwordAccountId } }))?.status).toBe(
    "PENDING_VERIFICATION",
  );
  await signOut(page);

  const beforeCollision = await prisma.userAccount.count();
  await page.goto(
    `/api/auth/providers/google/start?syntheticSubject=google-email-collision-001&syntheticEmail=${encodeURIComponent(passwordEmail)}`,
  );
  await expect(page).toHaveURL(/\/sign-in\?reason=oauth-email-collision/u);
  expect(await prisma.userAccount.count()).toBe(beforeCollision);
  expect(
    await prisma.externalIdentity.findUnique({
      where: {
        provider_providerAccountId: { provider: "GOOGLE", providerAccountId: "google-email-collision-001" },
      },
    }),
  ).toBeNull();

  await page.goto("/sign-in?reason=oauth-email-collision&provider=google&returnTo=/account/linked-identities");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  await page.getByLabel("Email or legacy Player name").fill(passwordEmail);
  await page.getByLabel("Password").fill("Harbor!Compass9River");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-in")),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/account/linked-identities");
  await expect.poll(async () => (await currentUser(page)).authenticated).toBe(true);
  const linkedStart = await page.evaluate(
    async (csrfToken) => {
      const response = await fetch("/api/passport/providers/begin", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken! },
        body: JSON.stringify({
          provider: "GITHUB",
          redirectPath: "/account/linked-identities",
          syntheticSubject: "github-password-owner-001",
          syntheticName: "Linked GitHub Owner",
          syntheticEmail: "linked.github@example.test",
        }),
      });
      return response.json() as Promise<{ authorizationUrl: string }>;
    },
    (await currentUser(page)).csrfToken,
  );
  await page.goto(new URL(linkedStart.authorizationUrl, page.url()).toString());
  await expect(page).toHaveURL(/\/account\/linked-identities\?linked=github/u);
  const linkedIdentity = await prisma.externalIdentity.findUnique({
    where: {
      provider_providerAccountId: { provider: "GITHUB", providerAccountId: "github-password-owner-001" },
    },
  });
  expect(linkedIdentity?.accountId).toBe(passwordAccountId);
  await signOut(page);
  await page.goto(
    "/api/auth/providers/github/start?returnTo=/passport&syntheticSubject=github-password-owner-001&syntheticName=Linked%20GitHub%20Owner&syntheticEmail=linked.github%40example.test",
  );
  await expect(page).toHaveURL(/\/passport\?signedInWith=github/u);
  expect((await currentUser(page)).user?.accountId).toBe(passwordAccountId);
  expect(await prisma.userAccount.count()).toBe(beforeCollision);

  await page.goto("/account/linked-identities");
  await page.getByRole("button", { name: "Connect", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: /Connect (Google|GitHub)\?/u })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await signOut(page);
  const cancelledStart = await page.request.get("/api/auth/providers/google/start", { maxRedirects: 0 });
  const simulatorLocation = cancelledStart.headers().location!;
  const cancelledState = new URL(simulatorLocation, "http://localhost:3217").searchParams.get("state")!;
  await page.goto(
    `/api/auth/providers/google/callback?state=${encodeURIComponent(cancelledState)}&error=access_denied`,
  );
  await expect(page).toHaveURL(/\/sign-in\?reason=oauth-cancelled/u);
  expect((await currentUser(page)).authenticated).toBe(false);

  await page.goto("/api/auth/providers/github/callback?state=invalid-state&code=invalid-code");
  await expect(page).toHaveURL(/\/sign-in\?reason=oauth-invalid/u);
  expect(await prisma.userAccount.count()).toBe(beforeCollision);
});

test("OAuth choices remain keyboard reachable and mobile-safe", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-in");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    const widths = await page
      .locator(".account-oauth__button")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
    expect(widths.every((width) => width > 200)).toBe(true);
  }
});

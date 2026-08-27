import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ensureSoundingLineFixture } from "../admiralty/phase3/ensure-sounding-line-fixture";

const password = process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!";
const accounts = {
  administrator: {
    accountId: "adm2-account-administrator",
    email: "administrator@admiralty.example.test",
    displayName: "Admiral Northstar",
  },
  target: { accountId: "adm2-account-ordinary", email: "ordinary@admiralty.example.test" },
};

test.beforeAll(async () => {
  await ensureSoundingLineFixture();
});

test("a synthetic S2 case executes only a consented registered R1 repair and verifies its result", async ({
  browser,
}) => {
  const admin = await signedInPage(browser, accounts.administrator, "/");
  await admin.page.getByRole("button", { name: accounts.administrator.displayName, exact: true }).click();
  await admin.page.getByRole("link", { name: "Admiralty", exact: true }).click();
  await admin.page.getByRole("link", { name: "Support cases", exact: true }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin/support/cases");
  await admin.page.getByLabel("Target canonical account ID").fill(accounts.target.accountId);
  await admin.page.getByLabel("Case title").fill("Synthetic bounded profile reconcile");
  const summary =
    "Reconcile the synthetic profile preference representation through the registered Support Pilot command.";
  await admin.page.getByLabel("Safe case summary visible to the account owner").fill(summary);
  await admin.page.getByLabel("Reconcile profile preferences").check();
  await admin.page.getByRole("button", { name: "Open support case and request consent" }).click();

  const target = await signedInPage(browser, accounts.target, "/account/support-access");
  await expect(target.page.getByText("wayfarer.profile.reconcile", { exact: true })).toBeVisible();
  await target.page.getByRole("button", { name: "Approve exact categories" }).click();
  await target.context.close();

  await admin.page.reload();
  const supportCase = admin.page.getByRole("article").filter({ hasText: summary });
  const privilegedWork = admin.page.getByRole("region", { name: "Confirm privileged work" }).last();
  await privilegedWork.getByLabel("Confirm current password").fill(password);
  await privilegedWork.getByRole("button", { name: "Verify for governed repair work" }).click();
  await expect(admin.page.getByText("Recent privileged assurance is active for governed repair work.")).toBeVisible();
  const grantId = await supportCase.getByLabel("Approved grant ID").inputValue();
  await supportCase.getByRole("button", { name: "Run read-only diagnosis" }).click();
  await expect(supportCase.getByRole("heading", { name: /Latest diagnostic execution/u })).toBeVisible();
  await supportCase.getByLabel(/Target ID for the selected registered repair/u).fill(await targetProfileId());
  await supportCase.getByRole("button", { name: "Create mutation preview" }).click();
  await expect(supportCase.getByText(/Registered command: wayfarer\.profile\.reconcile/u)).toBeVisible();
  await supportCase.getByRole("button", { name: "Execute registered repair" }).click();
  await expect(admin.page.getByText("VERIFIED_RESOLVED", { exact: true })).toBeVisible();
  expect(grantId).toMatch(/^[A-Za-z0-9_-]+$/u);
  await assertNoSeriousAxeViolations(admin.page);
  await admin.context.close();
});

async function signedInPage(browser: Browser, account: { email: string; displayName?: string }, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function targetProfileId() {
  const client = new PrismaClient();
  try {
    const profile = await client.playerProfile.findUnique({
      where: { accountId: accounts.target.accountId },
      select: { id: true },
    });
    if (!profile) throw new Error("ADMIRALTY_S2_SYNTHETIC_TARGET_PROFILE_MISSING");
    return profile.id;
  } finally {
    await client.$disconnect();
  }
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

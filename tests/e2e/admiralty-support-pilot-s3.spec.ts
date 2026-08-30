import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ensureSoundingLineFixture } from "../admiralty/phase3/ensure-sounding-line-fixture";

const password = process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!";
const accounts = {
  administrator: {
    email: "administrator@admiralty.example.test",
    displayName: "Admiral Northstar",
  },
  target: { accountId: "adm2-account-ordinary", email: "ordinary@admiralty.example.test" },
};
let signInClientOrdinal = 0;

test.beforeAll(async () => {
  await ensureSoundingLineFixture();
});

test("a synthetic S3 case closes after a read-only diagnosis and revokes its remaining access", async ({ browser }) => {
  const admin = await signedInPage(browser, accounts.administrator, "/");
  await admin.page.getByRole("button", { name: accounts.administrator.displayName, exact: true }).click();
  await admin.page.getByRole("link", { name: "Admiralty", exact: true }).click();
  await admin.page.getByRole("link", { name: "Support cases", exact: true }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin/support/cases");
  await admin.page.getByLabel("Target canonical account ID").fill(accounts.target.accountId);
  await admin.page.getByLabel("Case title").fill("Synthetic governed case closure");
  const summary = "Complete a read-only synthetic diagnosis and close the case without changing account data.";
  await admin.page.getByLabel("Safe case summary visible to the account owner").fill(summary);
  await admin.page.getByRole("button", { name: "Open support case and request consent" }).click();

  const target = await signedInPage(browser, accounts.target, "/account/support-access");
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
  await supportCase
    .getByLabel("Safe closure reason visible in the administrative record")
    .fill("The synthetic read-only investigation is complete and no repair is requested.");
  await supportCase.getByRole("button", { name: "Close case and revoke remaining access" }).click();
  await expect(supportCase.getByText("CLOSED", { exact: true })).toBeVisible();
  await expect(supportCase.getByText("REVOKED", { exact: true })).toBeVisible();
  await expect(supportCase.getByRole("button", { name: "Run read-only diagnosis" })).toHaveCount(0);
  expect(grantId).toMatch(/^[A-Za-z0-9_-]+$/u);
  await assertNoSeriousAxeViolations(admin.page);
  await admin.context.close();
});

async function signedInPage(browser: Browser, account: { email: string; displayName?: string }, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  // Keep each synthetic browser client distinct while preserving the real per-client sign-in guard.
  signInClientOrdinal += 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.13.${signInClientOrdinal}` });
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const signInResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/sign-in") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click({ noWaitAfter: true });
  expect((await signInResponse).status()).toBe(200);
  await expect(page).toHaveURL((url) => url.pathname === returnTo, { timeout: 30_000 });
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

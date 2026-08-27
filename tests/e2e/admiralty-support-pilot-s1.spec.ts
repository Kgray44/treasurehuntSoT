import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ensureSoundingLineFixture } from "../admiralty/phase3/ensure-sounding-line-fixture";

const password = process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!";
const accounts = {
  administrator: {
    accountId: "adm2-account-administrator",
    email: "administrator@admiralty.example.test",
    displayName: "Admiral Northstar",
  },
  target: {
    accountId: "adm2-account-ordinary",
    email: "ordinary@admiralty.example.test",
    displayName: "Ordinary Mariner",
  },
};

// Sounding Line executes selected browser specs against a fresh, candidate-owned
// SQLite database.  The dedicated S1 runner prepares the same fixture in its
// global setup; this is deliberately a no-op there and supplies it only for
// the ordinary authority topology.
test.beforeAll(async () => {
  await ensureSoundingLineFixture();
});

test("a synthetic owner-approved support case produces a responsive read-only diagnostic receipt", async ({
  browser,
}) => {
  const admin = await signedInPage(browser, accounts.administrator, "/");
  await admin.page.getByRole("button", { name: accounts.administrator.displayName, exact: true }).click();
  await admin.page.getByRole("link", { name: "Admiralty", exact: true }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin");
  await admin.page.getByRole("link", { name: "Support cases", exact: true }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin/support/cases");
  await expect(admin.page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
  await expect(admin.page.getByText(/Every S1 execution is read-only/u)).toBeVisible();
  await admin.page.getByLabel("Target canonical account ID").fill(accounts.target.accountId);
  await admin.page.getByLabel("Case title").fill("Synthetic sign-in diagnosis");
  const summary = "Review the synthetic account state and session diagnostics for the support walkthrough.";
  await admin.page.getByLabel("Safe case summary visible to the account owner").fill(summary);
  await admin.page.getByRole("button", { name: "Open support case and request consent" }).click();
  await expect(admin.page.getByText(summary, { exact: true })).toBeVisible();
  await expect(admin.page.getByText("AWAITING_CONSENT", { exact: true })).toBeVisible();
  await assertNoSeriousAxeViolations(admin.page);

  const target = await signedInPage(browser, accounts.target, "/account/support-access");
  await expect(target.page.getByText(summary, { exact: true })).toBeVisible();
  await target.page.getByRole("button", { name: "Approve exact categories" }).click();
  await expect(target.page.getByText("ACTIVE", { exact: true })).toBeVisible();
  await assertNoSeriousAxeViolations(target.page);
  await target.context.close();

  await admin.page.reload();
  const supportCase = admin.page.getByRole("article").filter({ hasText: summary });
  await expect(supportCase.getByText("ACTIVE", { exact: true })).toBeVisible();
  const privilegedWork = admin.page.getByRole("region", { name: "Confirm privileged work" }).last();
  await privilegedWork.getByLabel("Confirm current password").fill(password);
  await privilegedWork.getByRole("button", { name: "Verify for read-only diagnosis" }).click();
  await expect(admin.page.getByText("Recent privileged assurance is active for read-only diagnosis.")).toBeVisible();
  const grantId = await supportCase.getByLabel("Approved grant ID").inputValue();
  expect(grantId).toMatch(/^[A-Za-z0-9_-]+$/u);
  await supportCase.getByRole("button", { name: "Run read-only diagnosis" }).click();
  await expect(admin.page.getByRole("heading", { name: "Latest diagnostic execution · COMPLETE" })).toBeVisible();
  await expect(admin.page.getByText("INSUFFICIENT_SANITIZED_EVIDENCE", { exact: true })).toBeVisible();
  await expect(admin.page.getByText(/Proposed next action \(INFORMATION_ONLY\)/u)).toBeVisible();
  await expect(admin.page.getByText(/Auditable receipt digest:/u)).toBeVisible();
  await expect(admin.page.getByRole("button", { name: /repair|apply|execute/u })).toHaveCount(0);

  for (const viewport of [
    { width: 900, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await admin.page.setViewportSize(viewport);
    await admin.page.emulateMedia({ reducedMotion: "reduce" });
    await admin.page.reload();
    await expect(admin.page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
    const width = await admin.page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  }
  await assertNoSeriousAxeViolations(admin.page);
  await admin.context.close();
});

async function signedInPage(browser: Browser, account: { email: string; displayName: string }, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

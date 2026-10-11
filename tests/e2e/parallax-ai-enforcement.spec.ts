import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy, aiPricing, aiMaximumExposureNano } from "../../src/parallax/ai-policy";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000 });
test.skip(process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1", "Run the guarded unpaid Parallax browser fixture.");
test.afterAll(() => db.$disconnect());
const password = "Synthetic-A1-Enforcement-2026!";
const requestText = "Explain an unsupported glowing particle effect.";
type Creator = Awaited<ReturnType<typeof creator>>;
const receiptRoot = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

async function creator(browser: Browser, baseURL: string, label: string) {
  const account = await closureAccount(label);
  await activateWorkspaceCapability(account.id, "CREATOR");
  const context = await browser.newContext({ baseURL });
  await authenticateClosure(context, account, baseURL);
  const loaded = await (await context.request.get("/api/studio/parallax")).json();
  const draft = createSpatialDraft(randomUUID(), "Synthetic enforcement scene", null);
  const save = await context.request.post("/api/studio/parallax", {
    headers: { "x-csrf-token": loaded.csrfToken },
    data: { action: "SAVE", draft, revision: 0 },
  });
  expect(save.ok(), await save.text()).toBe(true);
  return { account, context, csrfToken: loaded.csrfToken as string, draft };
}
function input(owner: Creator, mode = "STANDARD") {
  return {
    action: "AI",
    kind: "ASSISTANT",
    draft: owner.draft,
    request: requestText,
    mode,
    selectedEntityId: owner.draft.content.entities[0].id,
    revision: 1,
    editorGeneration: 1,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
  };
}
async function request(owner: Creator, data = input(owner), context: BrowserContext = owner.context) {
  const response = await context.request.post("/api/studio/parallax", {
    headers: { "x-csrf-token": owner.csrfToken },
    data,
  });
  return { response, body: await response.json() };
}
async function operator(page: Page, context: BrowserContext, baseURL: string, label: string) {
  const account = await closureAccount(label);
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "ADMINISTRATOR" } });
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash: await hash(password, 10) } });
  await authenticateClosure(context, account, baseURL);
  return account;
}
async function confirm(panel: Locator, previewName: string) {
  await panel.getByRole("button", { name: previewName, exact: true }).click();
  await expect(panel.getByRole("button", { name: "Confirm & apply policy", exact: true })).toBeDisabled();
  await panel.getByLabel("Current password for privileged assurance").fill(password);
  await panel.getByRole("button", { name: "Verify current password", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Confirm & apply policy", exact: true })).toBeEnabled();
  const applied = panel
    .page()
    .waitForResponse((response) => response.url().endsWith("/api/admin/commands/ai-quota-policy/execute"));
  await panel.getByRole("button", { name: "Confirm & apply policy", exact: true }).click();
  const response = await applied;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(panel.getByRole("status").filter({ hasText: "Policy applied at revision" })).toBeVisible();
}
async function capture(page: Page, name: string) {
  await mkdir(receiptRoot, { recursive: true });
  await page.screenshot({ path: `${receiptRoot}/${name}.png`, fullPage: true });
}
async function usage(owner: Creator) {
  return (await (await owner.context.request.get("/api/studio/parallax")).json()).aiUsage;
}

test("People dossier allowance, suspension and advanced access govern actual Creator requests", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  if (process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1")
    throw new Error("PARALLAX_A1_UNPAID_PROVIDER_FIXTURE_REQUIRED");
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: {
      id: AI_CONTROL_ID,
      policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, advancedEnabled: true }),
    },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, advancedEnabled: true }) },
  });
  const owner = await creator(browser, baseURL!, "Synthetic quota enforcement Creator");
  await operator(page, context, baseURL!, "Synthetic quota enforcement operator");
  try {
    await page.goto(`/admin/people/${owner.account.id}`);
    const panel = page
      .locator("section.chartroom-panel")
      .filter({ has: page.getByRole("heading", { name: "AI usage & quotas", exact: true }) });
    await expect(panel).toContainText("Inherited platform default");
    expect(await usage(owner)).toMatchObject({ allowance: 500, source: "INHERITED", advancedEnabled: false });
    const denied = await request(owner, input(owner, "ADVANCED"));
    expect(denied.response.status()).toBe(403);
    expect(denied.body.code).toBe("ADVANCED_UNAVAILABLE");
    await panel.getByLabel("Monthly request allowance (blank inherits)").fill("750");
    await panel.getByLabel("Reason for user policy change").fill("Synthetic approved larger Creator allowance");
    await confirm(panel, "Preview user policy");
    expect(await usage(owner)).toMatchObject({ allowance: 750, source: "OVERRIDE" });
    await panel.getByLabel("Monthly request allowance (blank inherits)").fill("2");
    await panel.getByLabel("Reason for user policy change").fill("Synthetic smaller monthly allowance");
    await confirm(panel, "Preview user policy");
    expect(await usage(owner)).toMatchObject({ allowance: 2, remaining: 2 });
    expect((await request(owner)).response.ok()).toBe(true);
    expect((await request(owner)).response.ok()).toBe(true);
    const exhausted = await request(owner);
    expect(exhausted.response.status()).toBe(429);
    expect(exhausted.body.code).toBe("USER_MONTHLY_REQUESTS");
    expect(exhausted.body.usage).toMatchObject({ used: 2, remaining: 0 });
    const creatorPage = await owner.context.newPage();
    await creatorPage.goto(`/studio/parallax?definition=${owner.draft.content.definitionId}`);
    await creatorPage.getByRole("button", { name: /Ask Parallax/ }).click();
    await expect(creatorPage.getByRole("region", { name: "Spatial Assistant", exact: true })).toContainText(
      "Monthly allowance reached. Manual editing remains available.",
    );
    await capture(creatorPage, "quota-exhausted");
    await panel.getByRole("checkbox", { name: "Suspend AI access", exact: true }).check();
    await panel.getByLabel("Reason for user policy change").fill("Synthetic temporary AI suspension");
    await confirm(panel, "Preview user policy");
    expect((await request(owner)).body.code).toBe("AI_SUSPENDED");
    expect((await usage(owner)).enabled).toBe(false);
    await panel.getByRole("checkbox", { name: "Suspend AI access", exact: true }).uncheck();
    await panel.getByLabel("Monthly request allowance (blank inherits)").fill("10");
    await panel.getByLabel("Advanced eligibility").selectOption("true");
    await panel
      .getByLabel("Reason for user policy change")
      .fill("Synthetic reenable with approved advanced eligibility");
    await confirm(panel, "Preview user policy");
    expect(await usage(owner)).toMatchObject({ enabled: true, advancedEnabled: true, allowance: 10 });
    const advanced = input(owner, "ADVANCED");
    expect((await request(owner, advanced)).response.ok()).toBe(true);
    expect(
      (
        await db.aIUsageLedger.findFirstOrThrow({
          where: { accountId: owner.account.id, requestId: advanced.requestId },
        })
      ).model,
    ).toBe("gpt-6.1-sol");
    await panel.getByLabel("Reason for user policy change").fill("Synthetic restore inherited policy");
    await confirm(panel, "Preview restore inherited policy");
    expect(await usage(owner)).toMatchObject({ allowance: 500, source: "INHERITED", used: 3 });
    expect((await request(owner, input(owner, "ADVANCED"))).body.code).toBe("ADVANCED_UNAVAILABLE");
    await panel.getByRole("button", { name: "Refresh account usage", exact: true }).click();
    await expect(panel).toContainText("3 / 500");
    await capture(page, "people-dossier-usage");
    expect(await db.aIQuotaPolicyRevision.count({ where: { targetAccountId: owner.account.id } })).toBe(5);
    const forbidden = await owner.context.request.get(`/api/admin/ai-usage?section=user&accountId=${owner.account.id}`);
    expect(forbidden.status()).toBe(403);
    const other = await creator(browser, baseURL!, "Synthetic private-activity boundary Creator");
    try {
      expect(
        (await other.context.request.get(`/api/admin/ai-usage?section=history&accountId=${owner.account.id}`)).status(),
      ).toBe(403);
      expect(
        (
          await other.context.request.post("/api/admin/commands/ai-quota-policy/preview", {
            headers: { "x-csrf-token": other.csrfToken },
            data: {
              target: "GLOBAL",
              policy: { ...defaultAIGlobalPolicy, enabled: true },
              expectedRevision: 0,
              reason: "Synthetic forbidden mutation",
              idempotencyKey: randomUUID(),
            },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await other.context.close();
    }
  } finally {
    await owner.context.close();
  }
});

test("Global warning, stale policy review, disable and reservation cap match visible Admiralty controls", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const admin = await operator(page, context, baseURL!, "Synthetic global-budget operator");
  const owner = await creator(browser, baseURL!, "Synthetic global-budget Creator");
  try {
    await page.goto("/admin/ai-usage");
    await page.getByRole("button", { name: "Global Policy", exact: true }).click();
    const stalePage = await context.newPage();
    await stalePage.goto("/admin/ai-usage");
    await stalePage.getByRole("button", { name: "Global Policy", exact: true }).click();
    await page.getByLabel("Spending warning (USD)", { exact: true }).fill("0.000000001");
    await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic small warning threshold");
    await confirm(page.locator("main"), "Preview global policy");
    await stalePage.getByLabel("Reason for change", { exact: true }).fill("Synthetic stale policy revision review");
    const conflict = stalePage.waitForResponse((response) =>
      response.url().endsWith("/api/admin/commands/ai-quota-policy/preview"),
    );
    await stalePage.getByRole("button", { name: "Preview global policy", exact: true }).click();
    expect((await conflict).status()).toBe(409);
    await expect(stalePage.getByRole("status")).toContainText("The quota policy changed");
    await stalePage.close();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.getByText("Spending warning reached", { exact: true })).toBeVisible();
    await capture(page, "admiralty-spending-warning");
    await page.getByRole("button", { name: "Global Policy", exact: true }).click();
    await page.getByRole("checkbox", { name: "Enable live AI assistance", exact: true }).uncheck();
    await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic global disable enforcement");
    await confirm(page.locator("main"), "Preview global policy");
    expect((await usage(owner)).enabled).toBe(false);
    expect((await request(owner)).body.code).toBe("AI_DISABLED");
    await page.getByRole("checkbox", { name: "Enable live AI assistance", exact: true }).check();
    await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic global reenable enforcement");
    await confirm(page.locator("main"), "Preview global policy");
    expect((await usage(owner)).enabled).toBe(true);
    const overview = await (await page.request.get("/api/admin/ai-usage")).json();
    const reservation = Number(aiMaximumExposureNano(aiPricing["gpt-6-luna"], 12000, 4000));
    const cap = overview.usage.exposureNano + reservation - 1;
    await page.getByLabel("Global spending cap (USD)", { exact: true }).fill(String(cap / 1_000_000_000));
    await page
      .getByLabel("Reason for change", { exact: true })
      .fill("Synthetic cap rejects unfunded additional exposure");
    await confirm(page.locator("main"), "Preview global policy");
    const denied = await request(owner);
    expect(denied.response.status()).toBe(429);
    expect(denied.body.code).toBe("GLOBAL_MONTHLY_BUDGET");
    expect(await db.aIUsageLedger.count({ where: { accountId: owner.account.id } })).toBe(0);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await capture(page, "admiralty-global-cap");
    expect(await db.aIQuotaPolicyRevision.count({ where: { actorAccountId: admin.id, targetAccountId: null } })).toBe(
      4,
    );
  } finally {
    await owner.context.close();
  }
});

test("Independent browser sessions and users cannot reserve the same last capacity; retries stay durable", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await operator(page, context, baseURL!, "Synthetic quota-race operator");
  const one = await creator(browser, baseURL!, "Synthetic race Creator one"),
    two = await creator(browser, baseURL!, "Synthetic race Creator two");
  try {
    await page.goto("/admin/ai-usage");
    await page.getByRole("button", { name: "Global Policy", exact: true }).click();
    const overview = await (await page.request.get("/api/admin/ai-usage")).json();
    const reservation = Number(aiMaximumExposureNano(aiPricing["gpt-6-luna"], 12000, 4000));
    await page
      .getByLabel("Global spending cap (USD)", { exact: true })
      .fill(String((overview.usage.exposureNano + reservation) / 1_000_000_000));
    await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic single-reservation global race budget");
    await confirm(page.locator("main"), "Preview global policy");
    const globalRace = await Promise.all([request(one), request(two)]);
    expect(globalRace.filter((result) => result.response.ok())).toHaveLength(1);
    expect(globalRace.find((result) => !result.response.ok())?.body.code).toBe("GLOBAL_MONTHLY_BUDGET");
    await page.getByLabel("Global spending cap (USD)", { exact: true }).fill("10");
    await page.getByLabel("Reason for change", { exact: true }).fill("Synthetic restore race development capacity");
    await confirm(page.locator("main"), "Preview global policy");
    await page.goto(`/admin/people/${one.account.id}`);
    const panel = page
      .locator("section.chartroom-panel")
      .filter({ has: page.getByRole("heading", { name: "AI usage & quotas", exact: true }) });
    const used = (await usage(one)).used;
    await panel.getByLabel("Monthly request allowance (blank inherits)").fill(String(used + 1));
    await panel
      .getByLabel("Reason for user policy change")
      .fill("Synthetic single remaining request across browser sessions");
    await confirm(panel, "Preview user policy");
    const secondSession = await browser.newContext({ baseURL });
    await authenticateClosure(secondSession, one.account, baseURL!);
    try {
      const sessionRace = await Promise.all([request(one), request(one, input(one), secondSession)]);
      expect(sessionRace.filter((result) => result.response.ok())).toHaveLength(1);
      expect(sessionRace.find((result) => !result.response.ok())?.body.code).toBe("USER_MONTHLY_REQUESTS");
    } finally {
      await secondSession.close();
    }
    await panel.getByLabel("Monthly request allowance (blank inherits)").fill("500");
    await panel.getByLabel("Reason for user policy change").fill("Synthetic restore room for stable identity retry");
    await confirm(panel, "Preview user policy");
    const same = input(one);
    const duplicate = await Promise.all([request(one, same), request(one, same)]);
    expect(duplicate.some((result) => result.response.ok())).toBe(true);
    expect(duplicate.every((result) => result.response.ok() || result.body.code === "REQUEST_IN_PROGRESS")).toBe(true);
    const replay = await request(one, same);
    expect(replay.response.ok()).toBe(true);
    expect(
      await db.aIUsageLedger.count({ where: { accountId: one.account.id, idempotencyKey: same.idempotencyKey } }),
    ).toBe(1);
    const rows = await db.aIUsageLedger.findMany({ where: { accountId: { in: [one.account.id, two.account.id] } } });
    expect(rows.every((row) => row.status === "SETTLED" && row.exposureNano === BigInt(150000))).toBe(true);
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(
      `${receiptRoot}/quota-browser-races.json`,
      JSON.stringify(
        {
          schemaVersion: 1,
          globalAdmissions: globalRace.map((result) => result.response.status()),
          singleUserLimit: true,
          stableIdentityRows: 1,
          provider: "SYNTHETIC_UNPAID",
          settledRows: rows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await one.context.close();
    await two.context.close();
  }
});

import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { resolveAdmiraltyCapability } from "../../src/admiralty/capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { prepareParallaxModerationFixture } from "./fixtures/parallax-compatibility-governance";
import { expectUnavailableHtml } from "./fixtures/parallax-unavailable-html";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_ADMIRALTY_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

const password = "Synthetic-Parallax-Review-2026!";
async function operator() {
  const account = await closureAccount("Synthetic compatibility administrator");
  await db.accountRoleAssignment.create({
    data: { accountId: account.id, role: "ADMINISTRATOR", scopeType: "GLOBAL" },
  });
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash: await hash(password, 10) } });
  return account;
}
async function station(page: Page, path: string) {
  await page.locator(`nav[aria-label="Admiralty navigation"] a[href="${path}"]`).last().click();
  await expect(page).toHaveURL(new RegExp(path.replaceAll("/", "\\/") + "$"));
}
async function returnHome(page: Page, name: string, baseURL: string) {
  const safeReturn = page.getByRole("link", { name: "Safe return", exact: true });
  await expect(safeReturn).toHaveAttribute("href", "/account");
  await safeReturn.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Return to Home", exact: true }).click();
  await expect(page).toHaveURL(new URL("/", baseURL).href);
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`Admiralty read projections preserve bounded queries, redaction and return · ${viewport.name} · ${reducedMotion}`, async ({
      page,
      context,
      baseURL,
    }) => {
      const admin = await operator();
      const privateOwner = await closureAccount("Synthetic protected read owner");
      const canary = `PRIVATE-ADMIRALTY-COMPATIBILITY-${randomUUID()}`;
      await db.playerProfile.update({ where: { id: privateOwner.profileId }, data: { biography: canary } });
      expect((await db.playerProfile.findUniqueOrThrow({ where: { id: privateOwner.profileId } })).biography).toBe(
        canary,
      );
      await authenticateClosure(context, admin, baseURL!);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Platform Overview", exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(canary);
      await station(page, "/admin/community");
      const communityQuery = `compat-no-match-${randomUUID()}`;
      await page.getByRole("textbox", { name: "Search Community content", exact: true }).fill(communityQuery);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page).toHaveURL(
        (url) => url.pathname === "/admin/community" && url.searchParams.get("q") === communityQuery,
      );
      await expect(
        page.locator("main .chartroom-empty").getByText("No matching Community content", { exact: true }),
      ).toBeVisible();
      for (const [path, title] of [
        ["/admin/providers", "Providers"],
        ["/admin/releases", "Releases"],
      ]) {
        await station(page, path);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await expect(page.locator("body")).not.toContainText(canary);
        const response = await page.request.get(path);
        expect(response.status()).toBe(200);
        expect(await response.text()).not.toContain(canary);
      }
      await expect(page.getByRole("heading", { name: "Deployment authority", exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^(Deploy|Rollback|Restart|Promote|Retry deployment)$/ }),
      ).toHaveCount(0);
      await station(page, "/admin/investigate");
      const investigationQuery = `compat-no-match-${randomUUID()}`;
      await page.getByRole("textbox", { name: "What are you investigating?", exact: true }).fill(investigationQuery);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page).toHaveURL(
        (url) => url.pathname === "/admin/investigate" && url.searchParams.get("q") === investigationQuery,
      );
      await expect(
        page.locator("main .chartroom-empty").getByText("No authorized match", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("body")).not.toContainText(canary);
      expect(await page.request.get(page.url()).then((response) => response.text())).not.toContain(canary);
      await returnHome(page, "Synthetic compatibility administrator", baseURL!);
    });
  }

  test(`Admiralty denies ordinary and anonymous reads and partitions audit authority · ${viewport.name}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const ordinary = await closureAccount("Synthetic ordinary Admiralty-denied account");
    await authenticateClosure(context, ordinary, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const paths = [
      "/admin",
      "/admin/community",
      "/admin/providers",
      "/admin/releases",
      "/admin/investigate",
      "/admin/operations",
      "/admin/configuration",
    ];
    for (const path of paths) {
      const denied = await page.goto(path);
      expect(denied?.status()).toBe(404);
      await expectUnavailableHtml(denied, ["PRIVATE-ADMIRALTY-COMPATIBILITY-"]);
      await expect(page.getByRole("heading", { name: "Platform Overview", exact: true })).toHaveCount(0);
    }
    const audit = await closureAccount("Synthetic scoped audit operator");
    await db.accountRoleAssignment.create({
      data: { accountId: audit.id, role: "AUDIT_OPERATOR", scopeType: "GLOBAL" },
    });
    await authenticateClosure(context, audit, baseURL!);
    expect((await page.goto("/admin"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Platform Overview", exact: true })).toBeVisible();
    for (const [path, capability] of [
      ["/admin/community", "COMMUNITY_OBSERVE"],
      ["/admin/providers", "CONTENT_OBSERVE"],
      ["/admin/releases", "RELEASE_OBSERVE"],
    ] as const) {
      expect(
        resolveAdmiraltyCapability([{ role: "AUDIT_OPERATOR", scopeType: "GLOBAL", scopeId: null }], capability)
          .allowed,
      ).toBe(false);
      await expectUnavailableHtml(await page.goto(path), ["PRIVATE-ADMIRALTY-COMPATIBILITY-"]);
      const protectedTitle = {
        "/admin/community": "Community",
        "/admin/providers": "Providers",
        "/admin/releases": "Releases",
      }[path];
      await expect(page.getByRole("heading", { level: 1, name: protectedTitle, exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
    }
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      for (const path of paths) {
        const denied = await anonymous.request.get(new URL(path, baseURL!).href);
        expect(denied.status()).toBe(404);
        await expectUnavailableHtml(denied, ["PRIVATE-ADMIRALTY-COMPATIBILITY-"]);
      }
    } finally {
      await anonymous.close();
    }
  });

  test(`Governed lease and runtime policy previews require explicit privileged confirmation · ${viewport.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const admin = await operator();
    await authenticateClosure(context, admin, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    let executions = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/execute")) executions++;
    });
    await page.goto("/admin/operations");
    await page
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Synthetic compatibility preview only; preserve current leases.");
    await page.getByRole("button", { name: "Preview lease recovery", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Before you release leases", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm and release expired leases", exact: true })).toBeDisabled();
    await station(page, "/admin/configuration");
    const batch = page.getByRole("spinbutton", { name: "Jobs per worker batch", exact: true });
    await batch.fill((await batch.inputValue()) === "2" ? "3" : "2");
    await page
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Synthetic compatibility preview only; preserve the current worker policy.");
    await page.getByRole("button", { name: "Preview policy change", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Before you apply this policy", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm and apply policy", exact: true })).toBeDisabled();
    expect(executions).toBe(0);
    await returnHome(page, "Synthetic compatibility administrator", baseURL!);
  });

  test(`Support access stays owner-consented, scoped and revocable · ${viewport.name}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const admin = await operator();
    const target = await closureAccount(`Synthetic compatibility support target ${randomUUID().slice(0, 8)}`);
    await authenticateClosure(context, admin, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/admin");
    await station(page, "/admin/people");
    const targetName = (await db.playerProfile.findUniqueOrThrow({ where: { id: target.profileId } })).displayName;
    await page.getByRole("textbox", { name: "Search", exact: true }).fill(targetName);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("link", { name: targetName, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: targetName, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Approved support projection", exact: true })).toHaveCount(0);
    await page.getByLabel("Confirm current password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Verify for privileged work", exact: true }).click();
    await expect(page.getByText("Privileged assurance is active for this session.", { exact: true })).toBeVisible();
    const purpose = `Synthetic compatibility owner-authorized support ${randomUUID()}`;
    await page.getByRole("textbox", { name: "Purpose", exact: true }).fill(purpose);
    await page.getByRole("button", { name: "Request owner consent", exact: true }).click();
    await expect(page.getByText(/The target user must approve it\./)).toBeVisible();
    const ownerContext = await browser.newContext();
    try {
      await authenticateClosure(ownerContext, target, baseURL!);
      const ownerPage = await ownerContext.newPage();
      await ownerPage.goto(new URL("/account/support-access", baseURL!).href);
      await expect(ownerPage.getByText(purpose, { exact: true })).toBeVisible();
      await ownerPage.getByRole("button", { name: "Approve exact categories", exact: true }).click();
      await expect(ownerPage.getByText("ACTIVE", { exact: true })).toBeVisible();
      const grant = await db.supportAccessGrant.findFirstOrThrow({
        where: { targetAccountId: target.id, operatorAccountId: admin.id, status: "ACTIVE" },
      });
      expect(JSON.parse(grant.grantedScopes)).toEqual(["ACCOUNT_STATE"]);
      const targetState = await db.userAccount.findUniqueOrThrow({
        where: { id: target.id },
        select: { createdAt: true, claimedAt: true },
      });
      await page.getByRole("textbox", { name: "Grant ID", exact: true }).fill(grant.id);
      const approvedRead = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/admin/support/read" && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Read approved category", exact: true }).click();
      const approvedResponse = await approvedRead;
      expect(approvedResponse.status()).toBe(200);
      const approved = await approvedResponse.json();
      expect(approved.projection.scope).toBe("ACCOUNT_STATE");
      expect(approved.projection.account.createdAt).toBe(targetState.createdAt.toISOString());
      expect(approved.projection.account.claimedAt).toBe(targetState.claimedAt?.toISOString());
      expect(Object.keys(approved.projection).sort()).toEqual(["account", "scope"]);
      await expect(page.getByRole("heading", { name: "Approved support projection", exact: true })).toBeVisible();
      await page.getByRole("combobox", { name: "Scoped category", exact: true }).selectOption("AUTH_EVENTS");
      const wrongScope = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/admin/support/read" && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Read approved category", exact: true }).click();
      const scopeDenial = await wrongScope;
      expect(scopeDenial.status()).toBe(403);
      expect((await scopeDenial.json()).code).toBe("SUPPORT_GRANT_SCOPE_DENIED");
      await page.getByRole("combobox", { name: "Scoped category", exact: true }).selectOption("ACCOUNT_STATE");
      const restoredScope = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/admin/support/read" && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Read approved category", exact: true }).click();
      expect((await restoredScope).status()).toBe(200);
      await ownerPage.getByRole("button", { name: "Revoke now", exact: true }).click();
      await expect(ownerPage.getByText("REVOKED", { exact: true })).toBeVisible();
      const rejected = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/admin/support/read" && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Read approved category", exact: true }).click();
      expect((await rejected).status()).toBe(403);
      expect((await db.supportAccessGrant.findUniqueOrThrow({ where: { id: grant.id } })).status).toBe("REVOKED");
    } finally {
      await ownerContext.close();
    }
    await returnHome(page, "Synthetic compatibility administrator", baseURL!);
  });

  test(`Moderation queue and attached-target preview retain the second-reviewer gate · ${viewport.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const admin = await operator();
    const owner = await closureAccount("Synthetic moderation target owner");
    const reviewer = await closureAccount("Synthetic distinct moderation reviewer");
    const suffix = randomUUID().slice(0, 8);
    await db.playerProfile.update({
      where: { id: owner.profileId },
      data: { handle: `compat-mod-${suffix}`, normalizedHandle: `compat-mod-${suffix}`, defaultVisibility: "PUBLIC" },
    });
    await db.accountRoleAssignment.create({
      data: { accountId: reviewer.id, role: "MODERATION_OPERATOR", scopeType: "GLOBAL" },
    });
    const fixture = await prepareParallaxModerationFixture(db, owner.id, `compat-mod-${suffix}`);
    await authenticateClosure(context, admin, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/community/moderation");
    await expect(page.getByRole("heading", { name: "Moderation queue", exact: true })).toBeVisible();
    await page.getByRole("link", { name: fixture.caseKey, exact: true }).click();
    await expect(page.getByRole("heading", { name: `Case ${fixture.caseKey}`, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to moderation queue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Moderation queue", exact: true })).toBeVisible();
    await page.goto(`/admin/community/${fixture.listingId}`);
    let executions = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/execute")) executions++;
    });
    await page
      .getByRole("combobox", { name: "Case and target", exact: true })
      .selectOption({ label: `${fixture.caseKey} · Quarantine listing` });
    await page.getByRole("textbox", { name: "Second reviewer account ID", exact: true }).fill(admin.id);
    await page
      .getByRole("textbox", { name: "Reason", exact: true })
      .fill("Synthetic compatibility preview; no moderation action is approved.");
    const selfPreview = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/admin/commands/moderation/preview" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Preview moderation action", exact: true }).click();
    const selfDenial = await selfPreview;
    expect(selfDenial.status()).toBe(409);
    expect((await selfDenial.json()).code).toBe("ADMIN_CONFLICT");
    await expect(page.getByRole("heading", { name: "Before you apply this action", exact: true })).toHaveCount(0);
    expect((await db.communityListing.findUniqueOrThrow({ where: { id: fixture.listingId } })).moderationStatus).toBe(
      "ACTIVE",
    );
    expect((await db.communityModerationCase.findUniqueOrThrow({ where: { id: fixture.caseId } })).revision).toBe(1);
    await page.getByRole("textbox", { name: "Second reviewer account ID", exact: true }).fill(reviewer.id);
    await page.getByRole("button", { name: "Preview moderation action", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Before you apply this action", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Confirm.*action/ })).toBeDisabled();
    expect((await db.communityListing.findUniqueOrThrow({ where: { id: fixture.listingId } })).moderationStatus).toBe(
      "ACTIVE",
    );
    expect((await db.communityModerationCase.findUniqueOrThrow({ where: { id: fixture.caseId } })).revision).toBe(1);
    expect(executions).toBe(0);
    await returnHome(page, "Synthetic compatibility administrator", baseURL!);
  });
}

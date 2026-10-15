import { randomUUID } from "node:crypto";
import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { extractComposition, insertSpatialElement } from "../../src/parallax/element-authoring";
import { saveSpatialDraft } from "../../src/parallax/library-service";
import { builtinEnvironments, saveEnvironment } from "../../src/parallax/environment-service";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";

const captureRoot = path.join(
  "Development_Docs",
  "Projects",
  "Project_Parallax",
  "evidence",
  "sc-07a",
  "20261015-local",
);

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.afterAll(() => db.$disconnect());

async function approveWithSyntheticModerator(
  browser: Browser,
  baseURL: string,
  listingId: string,
  options: { captureName?: string; panelCaptureName?: string; forbiddenText?: string } = {},
) {
  const moderator = await closureAccount("Synthetic SC-07A Moderator");
  await db.accountRoleAssignment.create({ data: { accountId: moderator.id, role: "MODERATION_OPERATOR" } });
  const session = await db.accountSession.findFirstOrThrow({ where: { accountId: moderator.id } });
  await db.privilegedAssurance.create({
    data: {
      accountId: moderator.id,
      accountSessionId: session.id,
      assuranceLevel: "ADMIN_REAUTHENTICATED",
      method: "OTHER_GOVERNED_METHOD",
      expiresAt: new Date(Date.now() + 5 * 60_000),
      correlationId: randomUUID(),
    },
  });
  const moderatorContext = await browser.newContext();
  try {
    await authenticateClosure(moderatorContext, moderator, baseURL);
    const moderatorPage = await moderatorContext.newPage();
    await moderatorPage.setViewportSize({ width: 1280, height: 1200 });
    await moderatorPage.goto(`/admin/community/${listingId}`);
    const panel = moderatorPage.locator('section[aria-labelledby="spatial-publication-review-title"]');
    await expect(panel.getByRole("heading", { name: "Review exact spatial release" })).toBeVisible();
    await expect(panel.getByText("I own or have permission to distribute every included item.")).toBeVisible();
    await expect(
      panel
        .getByText("items/spatial.json", { exact: true })
        .or(panel.getByText("items/environment.json", { exact: true })),
    ).toBeVisible();
    if (options.forbiddenText) await expect(panel).not.toContainText(options.forbiddenText);
    if (options.captureName)
      await moderatorPage.screenshot({ path: path.join(captureRoot, options.captureName), fullPage: true });
    if (options.panelCaptureName) await panel.screenshot({ path: path.join(captureRoot, options.panelCaptureName) });
    await panel.getByLabel(/I reviewed the exact content, rights declaration/).check();
    await panel.getByRole("button", { name: "Approve and publish release" }).click();
    await expect(moderatorPage.getByRole("link", { name: "Open Community listing" })).toBeVisible();
    expect((await db.communityListing.findUniqueOrThrow({ where: { id: listingId } })).publicationStatus).toBe(
      "PUBLISHED",
    );
  } finally {
    await moderatorContext.close();
  }
}

test("Creator reviews a saved spatial item, submits it, and a second account installs the moderated release", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const url = process.env.DATABASE_URL ?? "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/validation-isolated-sc07a-[^/\\]*\.db$/i.test(url)
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
  const owner = await closureAccount("Synthetic SC-07A Creator");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `spatial-${suffix}`, normalizedHandle: `spatial-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Working draft saved");
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  const publishEntry = page.getByRole("button", { name: "Publish to Community", exact: true }).first();
  await publishEntry.click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toBeVisible();
  const captureMobile = async (name: string) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(captureRoot, name), fullPage: true });
  };
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 1");
  await expect(wizard.getByLabel("Saved source preview")).toContainText("Desk Map · parchment");
  await expect(wizard).toContainText("This is your private saved source");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-source-desktop.png"), fullPage: true });
  await captureMobile("sc07a-source-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`synthetic-desk-${suffix}`);
  await wizard.getByLabel("Description").fill("An imagined tabletop arrangement with an accessible clue.");
  await wizard.getByLabel("Tags, separated by commas").fill("tabletop, clue");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(captureRoot, "sc07a-description-desktop.png"), fullPage: true });
  await captureMobile("sc07a-description-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByRole("heading", { name: "Included content" })).toBeVisible();
  await captureMobile("sc07a-included-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByText("Visibility: Community after approval.")).toBeVisible();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(captureRoot, "sc07a-rights-desktop.png"), fullPage: true });
  await captureMobile("sc07a-rights-mobile.png");
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByText("SERVER-VERIFIED PACKAGE")).toBeVisible();
  await expect(wizard).toContainText("items/spatial.json");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await wizard.getByText("SERVER-VERIFIED PACKAGE").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-package-review-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await wizard.getByText("SERVER-VERIFIED PACKAGE").scrollIntoViewIfNeeded();
  await expect(
    wizard.getByText("Submitting creates an immutable Community release for moderation.", { exact: false }),
  ).toBeVisible();
  const submit = wizard.getByRole("button", { name: "Submit to Community" });
  await expect(submit).toBeDisabled();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-package-review-mobile.png"), fullPage: true });
  await wizard.getByText("Inspect the sanitized package").click();
  const packageJson = wizard.locator('pre[aria-label="Sanitized Community package JSON"]');
  await expect(packageJson).not.toContainText("chronicleId");
  await packageJson.focus();
  expect(await packageJson.evaluate((node) => node.scrollHeight)).toBeGreaterThan(
    await packageJson.evaluate((node) => node.clientHeight),
  );
  await page.keyboard.press("End");
  await expect.poll(() => packageJson.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await expect(submit).toBeEnabled();
  await submit.focus();
  await page.keyboard.press("Tab");
  await expect(wizard.getByRole("button", { name: "Close publishing" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")),
  ).toEqual([]);
  await submit.click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  await expect(wizard).toContainText("The Community listing is visible after moderation approves it.");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-submitted-mobile.png"), fullPage: true });
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `synthetic-desk-${suffix}` } });
  expect(listing.publicationStatus).toBe("READY_FOR_REVIEW");
  expect(
    (await context.request.get(`${baseURL}/api/admin/community/spatial-publication/${listing.id}/review`)).status(),
  ).toBe(403);
  await wizard.getByRole("button", { name: "Return to Spatial Studio" }).click();
  await expect(wizard).not.toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const library = page.locator('section[aria-label="Spatial content library"]');
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Open Spatial Library" }).click();
  await library.getByRole("tab", { name: "Scenes" }).click();
  await library.getByRole("button", { name: "Inspect Desk Map" }).click();
  const libraryPublish = library.getByRole("button", { name: "Publish to Community" }).first();
  await libraryPublish.click();
  await expect(wizard).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-library-entry-desktop.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(
    wizard.getByText("An earlier submission for this saved source is awaiting Community review.", { exact: false }),
  ).toBeVisible();
  await expect(wizard.getByRole("option", { name: /Update Desk Map/u })).toHaveAttribute("disabled", "");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-pending-update-desktop.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(wizard).not.toBeVisible();
  await expect(libraryPublish).toBeFocused();

  // A synthetic moderator uses the real capability, assurance, review and
  // approval route. This proves the application path, not a human decision.
  await approveWithSyntheticModerator(browser, baseURL!, listing.id, {
    captureName: "sc07a-moderation-review-desktop.png",
    panelCaptureName: "sc07a-moderation-panel-desktop.png",
  });
  const installer = await closureAccount("Synthetic SC-07A Installer");
  await db.playerProfile.update({
    where: { accountId: installer.id },
    data: { handle: `installer-${suffix}`, normalizedHandle: `installer-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(installer.id, "CREATOR");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.goto(`/community/${listing.slug}`);
    await expect(installPage.getByRole("heading", { name: "Install this exact release" })).toBeVisible();
    await expect(installPage.getByText(/SPATIAL ASSET/)).toBeVisible();
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-approved-listing-desktop.png"),
      fullPage: true,
    });
    await installPage.setViewportSize({ width: 390, height: 844 });
    await expect(installPage.getByText("Noncommercial Remix With Attribution", { exact: true })).toBeVisible();
    await installPage.screenshot({ path: path.join(captureRoot, "sc07a-approved-listing-mobile.png"), fullPage: true });
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await expect(installPage.getByRole("link", { name: "Open in Spatial Studio" })).toBeVisible();
    await installPage.reload();
    await expect(
      installPage.getByText("Ratings and reviews require a verified installation of this exact spatial release."),
    ).toBeVisible();
    await installPage.getByLabel("Preview-safe review").fill("The synthetic spatial asset installed as described.");
    await installPage.getByRole("button", { name: "Save review" }).click();
    await expect(installPage.getByText("Your review was saved.")).toBeVisible();
    await expect(installPage.getByText("The synthetic spatial asset installed as described.")).toBeVisible();
    await installPage.screenshot({ path: path.join(captureRoot, "sc07a-installed-review-mobile.png"), fullPage: true });
    await installPage.setViewportSize({ width: 1440, height: 1000 });
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-installed-review-desktop.png"),
      fullPage: true,
    });
    await installPage.setViewportSize({ width: 390, height: 844 });
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    await expect(installPage.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
    await expect(installPage.getByText("Installed Community release · read-only")).toBeVisible();
    await expect(installPage.getByRole("status")).toContainText("Installed Community release opened");
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-installed-library-mobile.png"),
      fullPage: true,
    });
    await installPage.setViewportSize({ width: 1440, height: 1000 });
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-installed-library-desktop.png"),
      fullPage: true,
    });
  } finally {
    await installContext.close();
  }
});

test("unlicensed physical model fails visibly and leaves the private saved item intact", async ({
  page,
  context,
  baseURL,
}) => {
  const url = process.env.DATABASE_URL ?? "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/validation-isolated-sc07a-[^/\\]*\.db$/i.test(url)
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
  const owner = await closureAccount("Synthetic SC-07A Rights Failure");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `rights-${suffix}`, normalizedHandle: `rights-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const draft = insertSpatialElement(createSpatialDraft(randomUUID()), "articulated-chest", randomUUID());
  draft.content.title = "Private chest study";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  await expect(page.getByRole("heading", { name: "Private chest study", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish to Community", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Review publishing limits" }).first().click();
  const wizard = page.getByRole("dialog", { name: "Review Community publishing" });
  await expect(wizard).toBeVisible();
  await expect(wizard.getByText("Known publishing limit:", { exact: false })).toContainText(
    "owner redistribution authorization",
  );
  await page.screenshot({ path: path.join(captureRoot, "sc07a-known-limit-desktop.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`private-chest-${suffix}`);
  await wizard.getByLabel("Description").fill("A synthetic test item with an unlicensed physical model reference.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await wizard.getByRole("button", { name: "Review package" }).click();
  const refusal = wizard.getByRole("alert");
  await expect(refusal).toContainText("owner redistribution authorization");
  await expect(refusal).toBeFocused();
  const noticeBox = await refusal.boundingBox();
  const footerBox = await wizard.locator("footer").boundingBox();
  expect(noticeBox && footerBox && noticeBox.y + noticeBox.height <= footerBox.y).toBe(true);
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).not.toBeVisible();
  expect(await db.communityListing.count({ where: { owner: { accountId: owner.id } } })).toBe(0);
  await page.screenshot({ path: path.join(captureRoot, "sc07a-rights-failure-mobile.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")),
  ).toEqual([]);
  await wizard.getByRole("button", { name: "Close publishing" }).click();
  await expect(wizard).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Private chest study", level: 1 })).toBeVisible();
  expect(await db.reusableAuthoringItem.findUnique({ where: { id: draft.content.definitionId } })).toMatchObject({
    ownerAccountId: owner.id,
    currentVersionNumber: 1,
  });
});

test("Creator submits a saved Scene with its pinned synthetic Environment", async ({ page, context, baseURL }) => {
  const url = process.env.DATABASE_URL ?? "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/validation-isolated-sc07a-[^/\\]*\.db$/i.test(url)
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
  const owner = await closureAccount("Synthetic SC-07A Scene Creator");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `scene-${suffix}`, normalizedHandle: `scene-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const environment = structuredClone(builtinEnvironments()[0].current.content);
  environment.id = randomUUID();
  environment.name = "Imaginary lantern room";
  environment.origin = "MANUAL";
  environment.sourceLabel = "C:\\private\\room-photo.jpg";
  const savedEnvironment = await saveEnvironment(owner.id, environment, 0);
  const scene = createSpatialDraft(randomUUID());
  scene.category = "SCENE_TEMPLATE";
  scene.content.environment = savedEnvironment.reference;
  scene.content.title = "Lantern harbor Scene";
  expect(await saveSpatialDraft(owner.id, scene, 0)).toBe(1);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(scene.content.definitionId)}`);
  await expect(page.getByRole("heading", { name: "Lantern harbor Scene", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Publish to Community", exact: true }).first().click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 1");
  await expect(wizard.getByLabel("Saved source preview")).toContainText(
    "Imaginary lantern room · pinned Environment revision 1",
  );
  await page.screenshot({ path: path.join(captureRoot, "sc07a-scene-source-desktop.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`lantern-scene-${suffix}`);
  await wizard.getByLabel("Description").fill("An imagined Scene in a synthetic lantern room.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByText("Pinned Environment")).toBeVisible();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByLabel(/I reviewed the Environment geometry/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByText("SERVER-VERIFIED PACKAGE")).toBeVisible();
  await expect(wizard).toContainText("items/environment.json");
  await expect(wizard).toContainText("Imaginary lantern room");
  await wizard.getByText("Inspect the sanitized package").click();
  await expect(wizard.locator("pre")).not.toContainText("room-photo.jpg");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-scene-environment-review-desktop.png"), fullPage: true });
  await expect(wizard.getByRole("button", { name: "Submit to Community" })).toBeDisabled();
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  const listing = await db.communityListing.findUniqueOrThrow({
    where: { slug: `lantern-scene-${suffix}` },
    include: { currentRelease: true },
  });
  expect(listing.publicationStatus).toBe("READY_FOR_REVIEW");
  expect(listing.currentRelease).toBeTruthy();
  const packageRow = await db.communityPackage.findUniqueOrThrow({ where: { releaseId: listing.currentRelease!.id } });
  const items = await db.communityPackageItem.findMany({ where: { packageId: packageRow.id } });
  expect(items).toHaveLength(2);
  expect(JSON.stringify(items)).not.toContain("room-photo.jpg");
  expect(await db.reusableAuthoringItem.findUnique({ where: { id: scene.content.definitionId } })).toMatchObject({
    ownerAccountId: owner.id,
    currentVersionNumber: 1,
  });
});

test("Creator publishes an owned synthetic Environment from Library and another Creator installs it", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const owner = await closureAccount("Synthetic SC-07A Environment Creator");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `environment-${suffix}`, normalizedHandle: `environment-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const environment = structuredClone(builtinEnvironments()[0].current.content);
  environment.id = randomUUID();
  environment.name = "Imaginary glasshouse";
  environment.origin = "MANUAL";
  environment.sourceLabel = "C:\\private\\glasshouse-photo.jpg";
  environment.fixtures = [
    {
      id: `planter-${suffix}`,
      name: "Imaginary planter",
      kind: "FURNITURE",
      position: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: "#60866b",
    },
  ];
  await saveEnvironment(owner.id, environment, 0);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto("/studio/parallax");
  const library = page.locator('section[aria-label="Spatial content library"]');
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Open Spatial Library" }).click();
  await library.getByRole("tab", { name: "Environments" }).click();
  await library.getByRole("button", { name: "Inspect Imaginary glasshouse" }).click();
  const details = library.getByRole("complementary", { name: "Imaginary glasshouse details" });
  await details.getByRole("button", { name: "Publish to Community" }).click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 1");
  await expect(wizard.getByLabel("Saved source preview")).toContainText("Imaginary planter · furniture");
  await expect(wizard).not.toContainText("glasshouse-photo.jpg");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-environment-source-desktop.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`imaginary-glasshouse-${suffix}`);
  await wizard.getByLabel("Description").fill("A wholly imagined synthetic glasshouse for spatial scenes.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByLabel(/I reviewed the Environment geometry/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByText("SERVER-VERIFIED PACKAGE")).toBeVisible();
  await expect(wizard).toContainText("items/environment.json");
  await wizard.getByText("SERVER-VERIFIED PACKAGE").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-environment-review-desktop.png"), fullPage: true });
  await wizard
    .getByText("Review this geometry carefully. A home layout can remain sensitive even without photographs.")
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(captureRoot, "sc07a-environment-geometry-warning-desktop.png"),
    fullPage: true,
  });
  await wizard.getByText("Inspect the sanitized package").click();
  await expect(wizard.locator("pre")).not.toContainText("glasshouse-photo.jpg");
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  const listing = await db.communityListing.findUniqueOrThrow({
    where: { slug: `imaginary-glasshouse-${suffix}` },
  });
  expect(listing.itemType).toBe("SPATIAL_ENVIRONMENT");
  expect(listing.publicationStatus).toBe("READY_FOR_REVIEW");

  await approveWithSyntheticModerator(browser, baseURL!, listing.id, {
    captureName: "sc07a-environment-moderation-review-desktop.png",
    panelCaptureName: "sc07a-environment-moderation-panel-desktop.png",
    forbiddenText: "glasshouse-photo.jpg",
  });
  const installer = await closureAccount("Synthetic SC-07A Environment Installer");
  await db.playerProfile.update({
    where: { accountId: installer.id },
    data: { handle: `env-installer-${suffix}`, normalizedHandle: `env-installer-${suffix}` },
  });
  await activateWorkspaceCapability(installer.id, "CREATOR");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.goto(`/community/${listing.slug}`);
    await expect(installPage.getByRole("heading", { name: "About this spatial environment" })).toBeVisible();
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await expect(installPage.getByRole("link", { name: "Open in Spatial Studio" })).toBeVisible();
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    const installedLibrary = installPage.locator('section[aria-label="Spatial content library"]');
    if (!(await installedLibrary.isVisible()))
      await installPage.getByRole("button", { name: "Open Spatial Library" }).click();
    await installedLibrary.getByRole("tab", { name: "Environments" }).click();
    await installedLibrary.getByRole("button", { name: "Inspect Imaginary glasshouse" }).click();
    await expect(installedLibrary).toContainText("Community installs");
    await expect(installedLibrary.getByRole("button", { name: "Publish to Community" })).toHaveCount(0);
    await expect(installedLibrary.getByRole("button", { name: "View Environment" })).toBeVisible();
    await expect(installedLibrary.getByRole("button", { name: "Manage Environment" })).toHaveCount(0);
    await installedLibrary
      .getByRole("complementary", { name: "Imaginary glasshouse details" })
      .scrollIntoViewIfNeeded();
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-environment-installed-library-desktop.png"),
      fullPage: true,
    });
    const installedCard = installedLibrary.locator("article", {
      has: installPage.getByRole("button", { name: "Inspect Imaginary glasshouse" }),
    });
    await installedCard.getByLabel("Actions for Imaginary glasshouse").click();
    await expect(installedCard.getByRole("button", { name: "View Environment" })).toBeVisible();
    await expect(installedCard.getByRole("button", { name: "Manage Environment" })).toHaveCount(0);
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-environment-actions-desktop.png"),
      fullPage: true,
    });
  } finally {
    await installContext.close();
  }
});

test("Creator publishes a verified saved composition and another Creator installs it into Compositions", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const url = process.env.DATABASE_URL ?? "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/validation-isolated-sc07a-[^/\\]*\.db$/i.test(url)
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
  const owner = await closureAccount("Synthetic SC-07A Composition Creator");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `composition-${suffix}`, normalizedHandle: `composition-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const parent = createSpatialDraft(randomUUID());
  parent.content.title = "Source desk arrangement";
  expect(await saveSpatialDraft(owner.id, parent, 0)).toBe(1);
  const composition = extractComposition(parent, parent.content.entities[0].id, randomUUID());
  composition.content.title = "Reusable desk clue";
  expect(await saveSpatialDraft(owner.id, composition, 0)).toBe(1);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(parent.content.definitionId)}`);
  await expect(page.getByRole("heading", { name: "Source desk arrangement", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Open Spatial Library" }).click();
  const library = page.locator('section[aria-label="Spatial content library"]');
  await library.getByRole("tab", { name: "Compositions" }).click();
  await library.getByRole("button", { name: "Inspect Reusable desk clue" }).click();
  const publish = library.getByRole("button", { name: "Publish to Community" }).first();
  await expect(publish).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-composition-source-desktop.png"), fullPage: true });
  await publish.click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 1");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`desk-composition-${suffix}`);
  await wizard.getByLabel("Description").fill("A reusable synthetic desk clue composition.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard).toContainText("Category: composition");
  await wizard.getByText("Inspect the sanitized package").click();
  await expect(wizard.locator("pre")).toContainText('"composition": true');
  await page.screenshot({ path: path.join(captureRoot, "sc07a-composition-review-desktop.png"), fullPage: true });
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `desk-composition-${suffix}` } });
  expect(listing.primaryCategory).toBe("COMPOSITION");
  expect(listing.publicationStatus).toBe("READY_FOR_REVIEW");
  await approveWithSyntheticModerator(browser, baseURL!, listing.id);
  const installer = await closureAccount("Synthetic SC-07A Composition Installer");
  await db.playerProfile.update({
    where: { accountId: installer.id },
    data: { handle: `composition-installer-${suffix}`, normalizedHandle: `composition-installer-${suffix}` },
  });
  await activateWorkspaceCapability(installer.id, "CREATOR");
  const installContext = await browser.newContext();
  try {
    await authenticateClosure(installContext, installer, baseURL!);
    const installPage = await installContext.newPage();
    await installPage.goto(`/community/${listing.slug}`);
    await expect(installPage.getByRole("heading", { name: "About this spatial composition" })).toBeVisible();
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-composition-listing-desktop.png"),
      fullPage: true,
    });
    await installPage.getByRole("button", { name: "Install to my Library" }).click();
    await expect(installPage.getByRole("link", { name: "Open in Spatial Studio" })).toBeVisible();
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    await expect(installPage.getByRole("heading", { name: "Reusable desk clue", level: 1 })).toBeVisible();
    await expect(installPage.getByText("Installed Community release · read-only")).toBeVisible();
    await installPage.getByRole("button", { name: "Open Spatial Library" }).click();
    const installedLibrary = installPage.locator('section[aria-label="Spatial content library"]');
    await installedLibrary.getByRole("tab", { name: "Compositions" }).click();
    await installedLibrary.getByRole("button", { name: "Inspect Reusable desk clue" }).click();
    await expect(installedLibrary).toContainText("Community installs · Installed composition");
    await expect(installedLibrary).toContainText("installed release · read-only");
    await expect(installedLibrary.getByRole("button", { name: "Add composition" })).toBeVisible();
    await expect(installedLibrary.getByRole("button", { name: "Publish to Community" })).toHaveCount(0);
    await expect(installedLibrary.getByRole("button", { name: "Archive…" })).toHaveCount(0);
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-composition-installed-library-desktop.png"),
      fullPage: true,
    });
  } finally {
    await installContext.close();
  }
});

test("an unconfirmed submission recovers by retrying the exact Harborlight release", async ({
  page,
  context,
  baseURL,
}) => {
  const url = process.env.DATABASE_URL ?? "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/validation-isolated-sc07a-[^/\\]*\.db$/i.test(url)
  )
    throw new Error("SC07A_OWNED_BROWSER_REQUIRED");
  const owner = await closureAccount("Synthetic SC-07A Interrupted Creator");
  const suffix = randomUUID().slice(0, 8);
  await db.playerProfile.update({
    where: { accountId: owner.id },
    data: { handle: `interrupted-${suffix}`, normalizedHandle: `interrupted-${suffix}`, defaultVisibility: "PUBLIC" },
  });
  await activateWorkspaceCapability(owner.id, "CREATOR");
  const draft = createSpatialDraft(randomUUID());
  draft.content.title = "Interrupted desk clue";
  expect(await saveSpatialDraft(owner.id, draft, 0)).toBe(1);
  await authenticateClosure(context, owner, baseURL!);
  await page.goto(`/studio/parallax?definition=${encodeURIComponent(draft.content.definitionId)}`);
  await expect(page.getByRole("heading", { name: "Interrupted desk clue", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Publish to Community", exact: true }).first().click();
  const wizard = page.getByRole("dialog", { name: "Publish to Community" });
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`interrupted-desk-${suffix}`);
  await wizard.getByLabel("Description").fill("A synthetic clue used to verify safe publication retry.");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await wizard.getByRole("button", { name: "Review package" }).click();
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  let dropped = false;
  await page.route("**/api/community/spatial-publication/publish", async (route) => {
    if (dropped) return route.continue();
    dropped = true;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort("failed");
  });
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("alert")).toContainText("did not confirm this submission");
  await expect(wizard.getByRole("alert")).toContainText("an exact retry returns the release");
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toHaveCount(0);
  const listing = await db.communityListing.findUniqueOrThrow({ where: { slug: `interrupted-desk-${suffix}` } });
  expect(listing.publicationStatus).toBe("READY_FOR_REVIEW");
  const releases = await db.communityRelease.findMany({ where: { listingId: listing.id } });
  expect(releases).toHaveLength(1);
  await page.screenshot({ path: path.join(captureRoot, "sc07a-unconfirmed-submission-desktop.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByRole("button", { name: "Submit to Community" })).toBeDisabled();
  await wizard.getByLabel(/I reviewed the included content, credits, warnings/).check();
  await wizard.getByRole("button", { name: "Submit to Community" }).click();
  await expect(wizard.getByRole("heading", { name: "Community review is next" })).toBeVisible();
  await expect(wizard).toContainText("This exact release is already submitted");
  expect(
    (await db.communityRelease.findMany({ where: { listingId: listing.id } })).map((release) => release.id),
  ).toEqual([releases[0].id]);
  await page.screenshot({ path: path.join(captureRoot, "sc07a-recovered-submission-desktop.png"), fullPage: true });
});

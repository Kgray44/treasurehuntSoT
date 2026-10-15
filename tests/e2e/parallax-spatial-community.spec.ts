import { randomUUID } from "node:crypto";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { insertSpatialElement } from "../../src/parallax/element-authoring";
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
    await page.setViewportSize({ width: 1440, height: 1000 });
  };
  await expect(wizard).toContainText("SAVED SOURCE · REVISION 1");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-source-desktop.png"), fullPage: true });
  await captureMobile("sc07a-source-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByLabel("Community address").fill(`synthetic-desk-${suffix}`);
  await wizard.getByLabel("Description").fill("An imagined tabletop arrangement with an accessible clue.");
  await wizard.getByLabel("Tags, separated by commas").fill("tabletop, clue");
  await page.screenshot({ path: path.join(captureRoot, "sc07a-description-desktop.png"), fullPage: true });
  await captureMobile("sc07a-description-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByRole("heading", { name: "Included content" })).toBeVisible();
  await captureMobile("sc07a-included-mobile.png");
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByText("Visibility: Community after approval.")).toBeVisible();
  await wizard.getByLabel(/I own or have permission to redistribute/).check();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-rights-desktop.png"), fullPage: true });
  await captureMobile("sc07a-rights-mobile.png");
  await wizard.getByRole("button", { name: "Review package" }).click();
  await expect(wizard.getByText("SERVER-VERIFIED PACKAGE")).toBeVisible();
  await expect(wizard).toContainText("items/spatial.json");
  await wizard.getByText("SERVER-VERIFIED PACKAGE").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-package-review-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await wizard.getByText("SERVER-VERIFIED PACKAGE").scrollIntoViewIfNeeded();
  await expect(wizard.getByText("Submitting creates an immutable Community release for moderation.", { exact: false })).toBeVisible();
  const submit = wizard.getByRole("button", { name: "Submit to Community" });
  await expect(submit).toBeDisabled();
  await page.screenshot({ path: path.join(captureRoot, "sc07a-package-review-mobile.png"), fullPage: true });
  await wizard.getByText("Inspect the sanitized package").click();
  const packageJson = wizard.locator('pre[aria-label="Sanitized Community package JSON"]');
  await expect(packageJson).not.toContainText("chronicleId");
  await packageJson.focus();
  await page.keyboard.press("End");
  expect(await packageJson.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
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

  // Harborlight moderation is a separate authority. This test-only state change
  // starts the public/install journey after approval; it is not moderation proof.
  await db.communityListing.update({
    where: { id: listing.id },
    data: { publicationStatus: "PUBLISHED", publishedAt: new Date() },
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
    await installPage.screenshot({
      path: path.join(captureRoot, "sc07a-installed-review-desktop.png"),
      fullPage: true,
    });
    await installPage.getByRole("link", { name: "Open in Spatial Studio" }).click();
    await expect(installPage.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
    await expect(installPage.getByText("Installed Community release · read-only")).toBeVisible();
    await expect(installPage.getByRole("status")).toContainText("Installed Community release opened");
    await installPage.screenshot({ path: path.join(captureRoot, "sc07a-installed-library-mobile.png"), fullPage: true });
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

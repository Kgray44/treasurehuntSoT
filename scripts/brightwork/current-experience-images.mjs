import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import {
  CURRENT_CAPTURE_STATUS,
  REQUIRED_VIEWPORTS,
  buildCaptureContract,
  buildRouteCensus,
  captureContractValidation,
  fileChecksum,
  reconciliationReport,
  sha256,
  stableJson,
  semanticCaptureIssue,
} from "./visual-evidence.mjs";

const root = path.resolve(process.cwd());
const imageRoot = path.join(root, "Experience_Images");
const brightworkRoot = path.join(root, "Development_Docs", "Projects", "Voyagewright_Brightwork");
const censusPath = path.join(brightworkRoot, "Current_Route_Census.json");
const screenCensusPath = path.join(brightworkRoot, "Current_Screen_Census.json");
const contractPath = path.join(brightworkRoot, "Visual_Capture_Contract.json");
const coveragePath = path.join(brightworkRoot, "Visual_Evidence_Coverage_Report.json");
const freshnessPath = path.join(brightworkRoot, "Visual_Evidence_Freshness_Report.json");
const limitationsPath = path.join(brightworkRoot, "Capture_Limitations_and_Blockers.md");
const auditorIndexPath = path.join(imageRoot, "auditor-index.json");
const command = process.argv[2] ?? "plan";

if (command === "plan") await plan();
else if (command === "capture") await capture();
else if (command === "capture-supplemental") await capture(true);
else if (command === "render") await render();
else if (command === "reconcile") await reconcile();
else if (command === "validate") await validate();
else if (command === "complete") await complete();
else throw new Error(`BRIGHTWORK_COMMAND_UNKNOWN:${command}`);

async function plan() {
  const source = auditedSources();
  const sourceSha = source.productSourceSha;
  const generatedAt = new Date().toISOString();
  const [legacyInventory, screenCatalog] = await Promise.all([
    json(path.join(root, "Development_Docs", "Projects", "Project_Homeport", "Homeport_Route_Inventory.json")),
    json(path.join(root, "Development_Docs", "Projects", "Project_Homeport", "Homeport_Screen_Catalog.json")),
  ]);
  const census = buildRouteCensus({
    appRoot: path.join(root, "src", "app"),
    legacyInventory,
    screenCatalog,
    sourceSha,
    auditRuntimeSourceSha: source.auditRuntimeSourceSha,
    generatedAt,
  });
  const contract = buildCaptureContract(census, generatedAt);
  const screens = Object.values(
    Object.fromEntries(
      census.routes.map((route) => [
        route.screenId,
        {
          screenId: route.screenId,
          routeIds: [route.routeId],
          routePatterns: [route.routePattern],
          productArea: route.productArea,
          applicableStates: route.meaningfulVisualStates,
          captureStatus: route.captureStatus,
        },
      ]),
    ),
  );
  await mkdir(brightworkRoot, { recursive: true });
  await Promise.all([
    writeJson(censusPath, census),
    writeJson(screenCensusPath, {
      schemaVersion: "2.0.0",
      artifact: "Voyagewright Brightwork current-main screen census",
      sourceSha,
      generatedAt,
      totalScreens: screens.length,
      screens,
    }),
    writeJson(contractPath, contract),
  ]);
  process.stdout.write(
    `${JSON.stringify({ status: "BRIGHTWORK_CAPTURE_PLAN_READY", sourceSha, auditRuntimeSourceSha: source.auditRuntimeSourceSha, routes: census.totals, requiredCaptures: contract.requirements.length })}\n`,
  );
}

async function capture(supplemental = false) {
  const [contract, census] = await Promise.all([json(contractPath), json(censusPath)]);
  const source = auditedSources();
  const sourceSha = source.productSourceSha;
  if (contract.sourceSha !== sourceSha || contract.auditRuntimeSourceSha !== source.auditRuntimeSourceSha)
    throw new Error("BRIGHTWORK_CAPTURE_PLAN_STALE_REPLAN_REQUIRED");
  const contractValidation = captureContractValidation({ contract, census });
  if (!contractValidation.valid)
    throw new Error(`BRIGHTWORK_CAPTURE_CONTRACT_INVALID:${contractValidation.failureCodes.join(",")}`);
  const existingManifest = supplemental ? await json(path.join(imageRoot, "manifest.json")) : null;
  const existingByIdentity = new Map((existingManifest?.records ?? []).map((record) => [record.identity, record]));
  const requirementsToCapture = supplemental
    ? contract.requirements.filter((requirement) => {
        const existing = existingByIdentity.get(requirement.identity);
        return (
          !existing ||
          existing.captureStatus === "BLOCKED_BY_PRODUCT" ||
          existing.requirementDigest !== requirement.requirementDigest
        );
      })
    : contract.requirements;
  const baseUrl = required("BRIGHTWORK_BASE_URL").replace(/\/$/u, "");
  const fixtureRoot = path.resolve(required("BRIGHTWORK_FIXTURE_ROOT"));
  const fixtureReceipt = await json(path.join(fixtureRoot, "reports", "fixture-receipt.json"));
  if (fixtureReceipt.sourceSha !== sourceSha) throw new Error("BRIGHTWORK_FIXTURE_SOURCE_MISMATCH");
  const auditReceipt = await json(required("BRIGHTWORK_AUDIT_METADATA_PATH"));
  if (
    auditReceipt.sourceSha !== source.auditRuntimeSourceSha ||
    auditReceipt.productBaselineSha !== sourceSha ||
    auditReceipt.classification !== "SYNTHETIC_DISPOSABLE_AUDIT_DATA" ||
    auditReceipt.environment?.buildMode !== "NEXT_PRODUCTION_BUILD" ||
    auditReceipt.environment?.deploymentData !== "BRIGHTWORK_TASK_OWNED_SYNTHETIC_DEPLOYMENT_AND_DATA"
  )
    throw new Error("BRIGHTWORK_AUDIT_ENVIRONMENT_METADATA_INVALID");
  const fixtureIdentity = sourceBoundFixtureIdentity({ fixtureReceipt, auditReceipt, source });
  const credentials = await loadCredentials(fixtureReceipt.credentials);
  const representatives = await representativeValues(fixtureReceipt.databasePath, credentials);
  const temporaryRoot = path.join(fixtureRoot, "capture-output");
  const temporaryImages = path.join(temporaryRoot, "Experience_Images");
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryImages, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const records = [];
  // Keep one source-faithful signed-in session per declared persona. Creating
  // one session per screenshot would exceed the product's real sign-in guard
  // and turn the audit itself into a false authorization failure.
  const authentications = new Map();
  try {
    const byContext = new Map();
    for (const requirement of requirementsToCapture) {
      const key = `${requirement.persona}|${requirement.theme}|${requirement.viewport}`;
      const group = byContext.get(key) ?? [];
      group.push(requirement);
      byContext.set(key, group);
    }
    for (const [key, requirements] of byContext) {
      const [persona, theme, viewportName] = key.split("|");
      const viewport = REQUIRED_VIEWPORTS.find((candidate) => candidate.id === viewportName);
      if (!viewport) throw new Error(`BRIGHTWORK_VIEWPORT_UNKNOWN:${viewportName}`);
      let authentication = authentications.get(persona);
      if (!authentication) {
        authentication = await storageState(browser, credentials, persona);
        if (authentication) authentications.set(persona, authentication);
      }
      const context = await browser.newContext({
        ...(authentication ? { storageState: authentication.storageState } : {}),
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme === "LIGHT" ? "light" : "dark",
        reducedMotion: "reduce",
        locale: "en-US",
      });
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme: theme === "LIGHT" ? "light" : "dark", reducedMotion: "reduce" });
      await page.addInitScript(
        ({ value }) => {
          sessionStorage.setItem("chronicle-role-gateway", "seen");
          localStorage.setItem(
            "voyagewright-theme-bootstrap-v1",
            JSON.stringify({ theme: value, contrast: "STANDARD", textScale: 1, motion: "REDUCED" }),
          );
        },
        { value: theme },
      );
      page.setDefaultTimeout(15_000);
      try {
        for (const requirement of requirements)
          records.push(
            await captureRequirement({
              page,
              requirement,
              temporaryImages,
              sourceSha,
              auditRuntimeSourceSha: source.auditRuntimeSourceSha,
              contract,
              fixtureReceipt,
              fixtureIdentity,
              auditEnvironment: auditReceipt.environment,
              browserVersion,
              representatives,
              ordinal: nextImageOrdinal(existingManifest?.records ?? [], records.length),
              baseUrl,
            }),
          );
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const retainedRecords = (existingManifest?.records ?? []).filter(
    (record) => !records.some((replacement) => replacement.identity === record.identity),
  );
  const allRecords = [...retainedRecords, ...records];
  const manifest = {
    schemaVersion: "2.1.0",
    project: "Voyagewright",
    artifact: "Brightwork current visual evidence corpus",
    fixture: fixtureReceipt.fixtureVersion,
    fixturePrivacyBasis: fixtureReceipt.privacyBasis,
    sourceSha,
    auditRuntimeSourceSha: source.auditRuntimeSourceSha,
    auditEnvironment: auditReceipt.environment,
    contractDigest: contract.contractDigest,
    generatedAt: new Date().toISOString(),
    browser: `Chromium ${browserVersion}`,
    visualReviewStatus: CURRENT_CAPTURE_STATUS,
    records: allRecords,
    ...(supplemental && existingManifest?.stage4b
      ? {
          stage4b: {
            ...existingManifest.stage4b,
            supplementalCaptureCount:
              Number(existingManifest.stage4b.supplementalCaptureCount ?? 0) +
              records.filter((record) => !existingByIdentity.has(record.identity)).length,
          },
        }
      : {}),
  };
  if (supplemental) {
    for (const record of records) {
      const source = path.join(temporaryImages, ...record.screenshotPath.split("/"));
      const destination = path.join(imageRoot, ...record.screenshotPath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    await writeJson(path.join(imageRoot, "manifest.json"), manifest);
    await createIndex(imageRoot, manifest);
    await createContactSheets(imageRoot, manifest);
    await writeFile(path.join(imageRoot, "README.md"), buildReadme(manifest), "utf8");
    await verifyManifestFiles(imageRoot, manifest);
    await rm(temporaryRoot, { recursive: true, force: true });
  } else {
    await writeJson(path.join(temporaryImages, "manifest.json"), manifest);
    await createIndex(temporaryImages, manifest);
    await createContactSheets(temporaryImages, manifest);
    await writeFile(path.join(temporaryImages, "README.md"), buildReadme(manifest), "utf8");
    await verifyManifestFiles(temporaryImages, manifest);
    await rm(imageRoot, { recursive: true, force: true });
    await mkdir(path.dirname(imageRoot), { recursive: true });
    await copyDirectory(temporaryImages, imageRoot);
  }
  await reconcile();
  process.stdout.write(
    `${JSON.stringify({ status: supplemental ? "BRIGHTWORK_SUPPLEMENTAL_EXPERIENCE_IMAGES_CAPTURED" : "BRIGHTWORK_CURRENT_EXPERIENCE_IMAGES_CAPTURED", sourceSha, captures: records.length, totalCaptures: allRecords.length, blocked: records.filter((record) => record.captureStatus === "BLOCKED_BY_PRODUCT").length })}\n`,
  );
}

async function render() {
  const manifest = await json(path.join(imageRoot, "manifest.json"));
  const prunedCanonicalFiles = await removeUnreferencedCanonicalFiles(imageRoot, manifest);
  await rm(path.join(imageRoot, "Contact_Sheets"), { recursive: true, force: true });
  await createIndex(imageRoot, manifest);
  await createContactSheets(imageRoot, manifest);
  await writeFile(path.join(imageRoot, "README.md"), buildReadme(manifest), "utf8");
  await verifyManifestFiles(imageRoot, manifest);
  const report = await reconcile();
  process.stdout.write(
    `${JSON.stringify({ status: "BRIGHTWORK_CONTACT_SHEETS_RENDERED", prunedCanonicalFiles, ...summary(report) })}\n`,
  );
}

async function captureRequirement(options) {
  const {
    page,
    requirement,
    temporaryImages,
    sourceSha,
    contract,
    fixtureReceipt,
    fixtureIdentity,
    auditEnvironment,
    auditRuntimeSourceSha,
    browserVersion,
    representatives,
    ordinal,
    baseUrl,
  } = options;
  const imageId = `BW-XI-${String(ordinal).padStart(4, "0")}`;
  const productArea = safeSegment(requirement.productArea);
  const relativePath = path.posix.join(
    "Canonical",
    requirement.theme,
    requirement.viewport,
    productArea,
    `${imageId}.png`,
  );
  const absolutePath = path.join(temporaryImages, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const concreteRoute = requirement.concreteRoute ?? resolveRoute(requirement.routePattern, representatives);
  const effectiveRequirement = requirement.expectedDestination
    ? { ...requirement, expectedDestination: resolveRoute(requirement.expectedDestination, representatives) }
    : requirement;
  let pageTitle = "Voyagewright";
  let captureStatus = CURRENT_CAPTURE_STATUS;
  let limitation =
    "Synthetic, task-owned fixture evidence. Capture exists for later Brightwork audit; it is not visual acceptance, owner acceptance, deployment, or live-provider proof.";
  let cleanup = async () => undefined;
  let semanticObservation = null;
  try {
    const prepared = await navigateForRequirement(page, `${baseUrl}${concreteRoute}`, requirement);
    cleanup = prepared.cleanup;
    const { response } = prepared;
    if (response && response.status() >= 500) throw new Error(`HTTP_${response.status()}`);
    const transitionSettled = await waitForStableReadyState(page, effectiveRequirement);
    semanticObservation = await observePage(page, response, effectiveRequirement, concreteRoute, transitionSettled);
    const semanticIssue = semanticCaptureIssue(effectiveRequirement, semanticObservation);
    if (semanticIssue) throw new Error(`BRIGHTWORK_SEMANTIC_CAPTURE_INVALID:${semanticIssue}`);
    pageTitle = semanticObservation.pageTitle;
    await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" });
    await cleanup();
  } catch (error) {
    await cleanup().catch(() => undefined);
    captureStatus = "BLOCKED_BY_PRODUCT";
    limitation = `Blocked by current product while capturing a synthetic representative instance: ${String(error.message ?? error).slice(0, 240)}`;
    await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" }).catch(() => undefined);
    if (!(await isNonEmpty(absolutePath)))
      await sharp({ create: { width: 800, height: 400, channels: 4, background: "#321418" } })
        .png()
        .toFile(absolutePath);
  }
  return {
    imageId,
    routeId: requirement.routeId,
    identity: requirement.identity,
    route: concreteRoute.split("?")[0],
    routePattern: requirement.routePattern,
    screenId: requirement.screenId,
    productArea: requirement.productArea,
    classification: requirement.classification,
    state: requirement.state,
    persona: requirement.persona,
    accountAlias: requirement.persona,
    fixture: fixtureReceipt.fixtureVersion,
    theme: requirement.theme,
    viewport: requirement.viewport,
    motionMode: requirement.motionMode,
    browserVersion: `Chromium ${browserVersion}`,
    sourceSha,
    auditRuntimeSourceSha,
    contractDigest: contract.contractDigest,
    requirementDigest: requirement.requirementDigest,
    capturedAt: new Date().toISOString(),
    screenshotPath: relativePath,
    sha256: fileChecksum(absolutePath),
    coverageKind: requirement.coverageKind,
    criticality: requirement.criticality,
    captureStatus,
    limitation,
    privacyBasis:
      "Synthetic fixture aliases only; credentials, tokens, private prose, media objects, and raw identifiers are excluded from the corpus.",
    visualReviewStatus: CURRENT_CAPTURE_STATUS,
    pageTitle,
    fixtureIdentity,
    auditEnvironment,
    semanticObservation,
  };
}

async function observePage(page, response, requirement, concreteRoute, transitionSettled) {
  const pageTitle = (await page.title()).replaceAll(/\s+/gu, " ").trim() || "Voyagewright";
  const body = (
    (await page
      .locator("body")
      .innerText()
      .catch(() => "")) ?? ""
  ).slice(0, 4_000);
  const final = new URL(page.url());
  const signInSurface =
    /(?:^|\/)sign-in$/u.test(final.pathname) ||
    (await page
      .getByLabel("Email or legacy Player name")
      .count()
      .catch(() => 0)) > 0;
  const semanticText = `${pageTitle}\n${body}`;
  const readyLandmarks = [];
  if (
    (await page
      .locator("[data-operational-status]")
      .count()
      .catch(() => 0)) > 0
  )
    readyLandmarks.push("CAPTAIN_OPERATIONAL_PROJECTION");
  if (
    (await page
      .locator("[data-captain-authority]")
      .count()
      .catch(() => 0)) > 0
  )
    readyLandmarks.push("CAPTAIN_MUSTER_PROJECTION");
  if (
    (await page
      .locator(".player-safe-preview:not(.platform-loading) h1")
      .count()
      .catch(() => 0)) > 0
  )
    readyLandmarks.push("PLAYER_SAFE_PREVIEW");
  if (
    (await page
      .locator("#private-operations-title")
      .count()
      .catch(() => 0)) > 0
  )
    readyLandmarks.push("PRIVATE_OPERATIONS_CONSOLE");
  for (const landmark of requirement.expectedReadyLandmarks ?? []) {
    let locator = page.locator(landmark.selector).first();
    if (landmark.text) locator = locator.filter({ hasText: landmark.text });
    if (await locator.isVisible().catch(() => false)) readyLandmarks.push(landmark.id);
  }
  const expectedPath = new URL(concreteRoute, "https://brightwork.invalid").pathname;
  return {
    httpStatus: response?.status() ?? null,
    finalPath: final.pathname,
    pageTitle,
    notFound: response?.status() === 404 || /(?:\b404\b|page could not be found|not found)/iu.test(semanticText),
    unauthorizedSurface:
      response?.status() === 401 ||
      response?.status() === 403 ||
      /(?:unauthorized|not authorized|permission denied|access is required|authorization is required)/iu.test(
        semanticText,
      ),
    unavailableSurface:
      /(?:\b(?:access|chronicle|console|muster room|operational view|page|preview|resource|route|voyage)\b[^.\n]{0,64}\bunavailable\b|\bcannot be (?:opened|accessed)\b|\bnot (?:currently )?available\b)/iu.test(
        semanticText,
      ),
    deadEndSurface:
      /\breturn to (?:chronicle|studio|captain|library)\b/iu.test(semanticText) &&
      /\b(?:access|route|page|chronicle)\b[^.\n]{0,64}\bunavailable\b/iu.test(semanticText),
    signInSurface,
    readyLandmarks: [...new Set(readyLandmarks)],
    visibleMain: await page.locator("main").first().isVisible().catch(() => false),
    expectedPathMatched: final.pathname === expectedPath,
    transitionSettled,
    syntheticRecordProven:
      requirement.classification !== "CONTEXTUAL_DYNAMIC_DESTINATION" || !/\[[^\]]+\]/u.test(concreteRoute),
  };
}

async function waitForStableReadyState(page, requirement) {
  if (requirement.state !== "READY") return true;
  const landmarks = requirement.expectedReadyLandmarks ?? [];
  for (const landmark of landmarks) {
    let locator = page.locator(landmark.selector).first();
    if (landmark.text) locator = locator.filter({ hasText: landmark.text });
    await locator.waitFor({ state: "visible", timeout: 10_000 });
  }
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  const specificLandmarks = landmarks.filter((landmark) => !landmark.id.endsWith(":MAIN_CONTENT"));
  if (!specificLandmarks.length) {
    // Generic route entries can hydrate a client-side redirect or an initial
    // read model after DOM content is ready. Observe only after that transition
    // has had a bounded chance to settle; do not mistake its initial copy for
    // the route's READY state.
    await page.waitForTimeout(300);
    return page.evaluate(
      () => document.readyState === "complete" && !document.querySelector('main[aria-busy="true"], [data-transitioning="true"]'),
    );
  }
  const snapshot = await page.evaluate((selectors) => {
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { width: rect.width, height: rect.height, opacity: style.opacity, visibility: style.visibility };
    });
  }, specificLandmarks.map((landmark) => landmark.selector));
  await page.waitForTimeout(120);
  const repeated = await page.evaluate((selectors) => {
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { width: rect.width, height: rect.height, opacity: style.opacity, visibility: style.visibility };
    });
  }, specificLandmarks.map((landmark) => landmark.selector));
  return stableJson(snapshot) === stableJson(repeated);
}

async function navigateForRequirement(page, url, requirement) {
  if (requirement.captureAction === "COMMUNITY_LOADING") {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/community/discover?**", async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    const response = await settledGoto(page, url);
    const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
    await search.fill("brightwork-loading-state");
    const pending = search.press("Enter");
    await page.locator(".ui-loading-state").waitFor({ timeout: 5_000 });
    return {
      response,
      cleanup: async () => {
        release();
        await pending.catch(() => undefined);
        await page.unroute("**/api/community/discover?**");
      },
    };
  }
  if (requirement.captureAction === "COMMUNITY_ERROR") {
    await page.route("**/api/community/discover?**", async (request) =>
      request.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unavailable" }),
      }),
    );
    const response = await settledGoto(page, url);
    const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
    await search.fill("brightwork-error-state");
    await search.press("Enter");
    await page.locator(".community-state--error").waitFor({ timeout: 5_000 });
    return { response, cleanup: () => page.unroute("**/api/community/discover?**") };
  }
  if (requirement.captureAction === "CAPTAIN_LOADING") {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/captain/voyages/**", async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    const response = await settledGoto(page, url);
    await page.getByText("Reading operational state").waitFor({ timeout: 5_000 });
    return {
      response,
      cleanup: async () => {
        release();
        await page.unroute("**/api/captain/voyages/**");
      },
    };
  }
  if (requirement.captureAction === "CAPTAIN_ERROR") {
    await page.route("**/api/captain/voyages/**", async (request) =>
      request.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Task-owned Brightwork synthetic outage." }),
      }),
    );
    const response = await settledGoto(page, url);
    await page.getByText("Operational view unavailable").waitFor({ timeout: 5_000 });
    return { response, cleanup: () => page.unroute("**/api/captain/voyages/**") };
  }
  if (requirement.captureAction === "CAPTAIN_DESTRUCTIVE_CONFIRMATION") {
    const response = await settledGoto(page, url);
    await page.locator("[data-operational-status]").first().waitFor({ timeout: 5_000 });
    await page.getByRole("button", { name: "Cancel Voyage for Everyone" }).click();
    await page.getByText("Cancel Voyage for Everyone", { exact: true }).last().waitFor({ timeout: 5_000 });
    return { response, cleanup: async () => undefined };
  }
  if (requirement.captureAction === "PRIVATE_OPERATIONS_LOADING") {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/studio/private-content/operations", async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    const response = await settledGoto(page, url);
    await page.getByText("Loading operational status.").waitFor({ timeout: 5_000 });
    return {
      response,
      cleanup: async () => {
        release();
        await page.unroute("**/api/studio/private-content/operations");
      },
    };
  }
  if (requirement.captureAction === "PRIVATE_OPERATIONS_DEPENDENCY_UNAVAILABLE") {
    await page.route("**/api/studio/private-content/operations", async (request) =>
      request.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Task-owned Brightwork synthetic dependency outage." }),
      }),
    );
    const response = await settledGoto(page, url);
    await page
      .getByText("Operational status is unavailable or requires Administrator access.")
      .waitFor({ timeout: 5_000 });
    return { response, cleanup: () => page.unroute("**/api/studio/private-content/operations") };
  }
  const response = await settledGoto(page, url);
  if (requirement.captureAction === "KEYBOARD_FOCUS") await page.keyboard.press("Tab");
  if (requirement.captureAction === "ZOOM_200")
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
  return { response, cleanup: async () => undefined };
}

async function settledGoto(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("body").waitFor();
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(180);
  return response;
}

async function reconcile() {
  const [contract, manifest, census] = await Promise.all([
    json(contractPath),
    json(path.join(imageRoot, "manifest.json")),
    json(censusPath),
  ]);
  const report = reconciliationReport({ contract, manifest, sourceSha: contract.sourceSha, imageRoot, census });
  const combined = { ...report, routeTotals: census.totals, generatedAt: new Date().toISOString() };
  await Promise.all([writeJson(coveragePath, combined), writeJson(freshnessPath, combined)]);
  await writeLimitations(combined);
  await writeAuditorIndex(manifest, combined);
  process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_RECONCILIATION_COMPLETE", ...summary(combined) })}\n`);
  return combined;
}

async function validate() {
  const report = await reconcile();
  const failures = [];
  if (report.missingCaptures) failures.push(`MISSING:${report.missingCaptures}`);
  if (report.staleCaptures) failures.push(`STALE:${report.staleCaptures}`);
  if (report.unexpectedOrphanedCaptures) failures.push(`ORPHANED:${report.unexpectedOrphanedCaptures}`);
  if (report.duplicateCanonicalIdentities) failures.push(`DUPLICATE_IDENTITIES:${report.duplicateCanonicalIdentities}`);
  if (report.duplicateCanonicalImageIds) failures.push(`DUPLICATE_IMAGE_IDS:${report.duplicateCanonicalImageIds}`);
  if (report.malformedCanonicalIdentities) failures.push(`MALFORMED_IDENTITIES:${report.malformedCanonicalIdentities}`);
  if (report.personaContractMismatches) failures.push(`PERSONA_MISMATCHES:${report.personaContractMismatches}`);
  if (report.semanticInvalidCaptures) failures.push(`SEMANTIC_INVALID:${report.semanticInvalidCaptures}`);
  if (failures.length) throw new Error(`BRIGHTWORK_VISUAL_EVIDENCE_INVALID:${failures.join(",")}`);
  process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_VISUAL_EVIDENCE_VALID", ...summary(report) })}\n`);
}

async function complete() {
  const report = await reconcile();
  const sourceSha = report.sourceSha;
  const status = report.blockedByProduct
    ? "BRIGHTWORK STAGE 1 — VISUAL EVIDENCE READY WITH PRODUCT BLOCKERS"
    : "BRIGHTWORK STAGE 1 — CURRENT VISUAL EVIDENCE READY";
  const record = `---\ntitle: Brightwork Stage 1 Completion Record\naudience: engineering-evidence\nstatus: current\ncanonical_for: brightwork-stage-1-completion\nlast_reviewed: ${new Date().toISOString().slice(0, 10)}\n---\n\n# Brightwork Stage 1 Completion Record\n\nStatus: **${status}**\n\n- Source SHA: \`${sourceSha}\`\n- Page routes: ${report.routeTotals.allPageRoutes}\n- Human-facing routes: ${report.routeTotals.humanFacingRoutes}\n- Navigable / contextual / tokenized / compatibility / development / excluded: ${report.routeTotals.navigableRoutes} / ${report.routeTotals.contextualDynamicRoutes} / ${report.routeTotals.tokenizedOrDeepLinkRoutes} / ${report.routeTotals.compatibilityRoutes} / ${report.routeTotals.developmentOnlyRoutes} / ${report.routeTotals.excludedInternalNonPageRoutes}\n- Required / current / stale / missing / blocked / excluded captures: ${report.requiredCaptures} / ${report.currentCaptures} / ${report.staleCaptures} / ${report.missingCaptures} / ${report.blockedByProduct} / ${report.excludedByClassification}\n- Fixture and privacy basis: task-owned combined Homeport and Admiralty synthetic fixtures; private credentials remain outside the repository.\n- Capture browser: recorded per manifest record.\n- Auditor index: \`Experience_Images/index.html\`, \`Experience_Images/auditor-index.json\`, and \`Experience_Images/Contact_Sheets\`.\n\nThe captures are evidence awaiting later Brightwork review. They do not establish product-quality acceptance, deployment, live-provider, or owner acceptance.\n`;
  await writeFile(path.join(brightworkRoot, "Brightwork_Stage_1_Completion_Record.md"), record, "utf8");
  process.stdout.write(`${JSON.stringify({ status, ...summary(report) })}\n`);
}

async function loadCredentials(paths) {
  const [homeport, admiralty, creator] = await Promise.all([json(paths.homeport), json(paths.admiralty), json(paths.creator)]);
  const homeportAccounts = homeport.accounts ?? homeport.aliases;
  const admiraltyAccounts = admiralty.accounts ?? admiralty.aliases;
  const choose = (source, preferred) => preferred.map((key) => source[key]).find(Boolean);
  return {
    ANONYMOUS: null,
    ORDINARY_PLAYER: choose(homeportAccounts, ["FULL_CAPABILITY", "VERIFIED_FULL_CAPABILITY", "SERA_OWNER"]),
    CAPTAIN_PLAYER: choose(homeportAccounts, ["FULL_CAPABILITY", "RETURNING_FULL_CAPABILITY"]),
    CREATOR: creator.account,
    MODERATOR: choose(homeportAccounts, ["MODERATOR", "FULL_CAPABILITY"]),
    ADMIRALTY_OPERATOR: choose(admiraltyAccounts, ["ADMINISTRATOR"]),
    passwords: { homeport: homeport.password, admiralty: admiralty.password, creator: creator.password },
    admiraltyAccounts,
  };
}

async function storageState(browser, credentials, persona) {
  if (persona === "ANONYMOUS") return undefined;
  const account = credentials[persona];
  if (!account?.email) throw new Error(`BRIGHTWORK_PERSONA_CREDENTIAL_MISSING:${persona}`);
  const password =
    persona === "ADMIRALTY_OPERATOR"
      ? credentials.passwords.admiralty
      : persona === "CREATOR"
        ? credentials.passwords.creator
        : credentials.passwords.homeport;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${required("BRIGHTWORK_BASE_URL").replace(/\/$/u, "")}/sign-in`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByLabel("Email or legacy Player name").fill(account.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForFunction(
      () =>
        fetch("/api/auth/context", { cache: "no-store" })
          .then((response) => response.json())
          .then((value) => value.status === "authenticated"),
      undefined,
      { timeout: 15_000 },
    );
    // Some role-entry paths retain the sign-in location after the cookie has
    // been established. Give the form's own navigation a chance to settle,
    // but make the authenticated context (not a URL transition) decisive.
    await page.waitForTimeout(300);
    const snapshot = await context.storageState();
    await context.close();
    return { storageState: snapshot };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function representativeValues(databasePath, credentials) {
  const db = new PrismaClient({ datasources: { db: { url: sqliteUrl(databasePath) } } });
  try {
    const ordinary = await db.playerProfile.findFirst({
      where: { accountId: credentials.ORDINARY_PLAYER?.accountId, status: "ACTIVE", handle: { not: null } },
      orderBy: { id: "asc" },
    });
    const [
      chronicle,
      listing,
      collection,
      guide,
      voyageLog,
      moderation,
      artifact,
      history,
      session,
      captainSession,
      studioTale,
    ] = await Promise.all([
      db.chronicle.findFirst({ where: { status: "PUBLISHED" }, orderBy: { id: "asc" } }),
      db.communityListing.findFirst({
        where: { publicationStatus: "PUBLISHED", visibility: { in: ["COMMUNITY", "FEATURED"] }, archivedAt: null },
        orderBy: { id: "asc" },
      }),
      db.communityCollection.findFirst({ orderBy: { id: "asc" } }),
      db.communityGuideContent.findFirst({ orderBy: { id: "asc" } }),
      db.communityVoyageLog.findFirst({
        where: { ownerAccountId: credentials.ORDINARY_PLAYER?.accountId },
        orderBy: { id: "asc" },
      }),
      db.communityModerationCase.findFirst({ orderBy: { id: "asc" } }),
      db.playerArtifactRecord.findFirst({ where: { playerProfileId: ordinary?.id }, orderBy: { id: "asc" } }),
      db.playerChronicleRecord.findFirst({
        where: { playerProfileId: ordinary?.id },
        orderBy: { id: "asc" },
        select: {
          id: true,
          sourcePlaythroughId: true,
          publishedVersion: { select: { tale: { select: { slug: true } } } },
        },
      }),
      db.taleSession.findFirst({
        where: { memberships: { some: { playerProfileId: ordinary?.id } } },
        orderBy: { id: "asc" },
        include: { tale: true },
      }),
      db.taleSession.findFirst({
        where: { captainAccountId: credentials.CAPTAIN_PLAYER?.accountId, status: "ACTIVE" },
        orderBy: { id: "asc" },
      }),
      db.chronicle.findFirst({
        where: { creatorAccountId: credentials.CREATOR?.accountId, status: "DRAFT" },
        orderBy: { id: "asc" },
      }),
    ]);
    const adminTarget = credentials.admiraltyAccounts?.SUPPORT_TARGET ?? credentials.ADMIRALTY_OPERATOR;
    const values = {
      chronicleId: chronicle?.id,
      taleId: studioTale?.id,
      taleSlug: chronicle?.slug,
      campaignSlug: chronicle?.slug,
      listingSlug: listing?.slug,
      listingId: listing?.id,
      collectionSlug: collection?.slug,
      handle: ordinary?.handle,
      guideSlug: guide?.slug,
      voyageLogSlug: voyageLog?.slug,
      voyageLogId: voyageLog?.id,
      moderationId: moderation?.id,
      artifactId: artifact?.id,
      recordId: history?.id,
      historyPlaythroughId: history?.sourcePlaythroughId,
      historyTaleSlug: history?.publishedVersion?.tale?.slug,
      sessionId: captainSession?.id,
      playthroughId: captainSession?.id,
      voyageId: captainSession?.id,
      accountId: adminTarget?.accountId,
      workspace: "chapters",
    };
    for (const [key, value] of Object.entries(values))
      if (!value) throw new Error(`BRIGHTWORK_REPRESENTATIVE_MISSING:${key}`);
    return values;
  } finally {
    await db.$disconnect();
  }
}

function resolveRoute(pattern, values) {
  let route = pattern;
  const named = {
    "[chronicleId]": values.chronicleId,
    "[listingId]": values.listingId,
    "[accountId]": values.accountId,
    "[voyageId]": values.voyageId,
    "[sessionId]": values.sessionId,
    "[playthroughId]": values.playthroughId,
    "[taleId]": values.taleId,
    "[taleSlug]": values.taleSlug,
    "[campaignSlug]": values.campaignSlug,
    "[artifactId]": values.artifactId,
    "[recordId]": values.recordId,
    "[historyPlaythroughId]": values.historyPlaythroughId,
    "[historyTaleSlug]": values.historyTaleSlug,
    "[handle]": values.handle,
    "[workspace]": values.workspace,
  };
  for (const [placeholder, value] of Object.entries(named))
    route = route.replaceAll(placeholder, encodeURIComponent(value));
  if (route.includes("[slug]")) {
    const slug = route.includes("collections")
      ? values.collectionSlug
      : route.includes("guides")
        ? values.guideSlug
        : route.includes("voyage-logs")
          ? values.voyageLogSlug
          : values.listingSlug;
    route = route.replaceAll("[slug]", encodeURIComponent(slug));
  }
  if (route.includes("[id]"))
    route = route.replaceAll(
      "[id]",
      encodeURIComponent(route.includes("moderation") ? values.moderationId : values.voyageLogId),
    );
  if (/\[[^\]]+\]/u.test(route)) throw new Error(`BRIGHTWORK_UNRESOLVED_DYNAMIC_ROUTE:${pattern}`);
  if (
    /^\/(reset-password|verify-email|account\/(claim|merge|email-change|reactivate|cancel-deletion)|player\/invitation)/u.test(
      route,
    )
  )
    return `${route}?token=brightwork-invalid-token`;
  return route;
}

async function createIndex(output, manifest) {
  const byArea = Object.groupBy(manifest.records, (record) => record.productArea);
  const index = {
    schemaVersion: "1.0.0",
    sourceSha: manifest.sourceSha,
    generatedAt: new Date().toISOString(),
    areas: Object.fromEntries(Object.entries(byArea).map(([area, records]) => [area, records.map(indexRecord)])),
    routes: Object.groupBy(manifest.records, (record) => record.routePattern),
  };
  await writeJson(path.join(output, "auditor-index.json"), index);
  const cards = manifest.records
    .map(
      (record) =>
        `<article data-area="${escapeHtml(record.productArea)}" data-theme="${record.theme}" data-viewport="${record.viewport}"><a href="${encodeURI(record.screenshotPath)}"><img loading="lazy" src="${encodeURI(record.screenshotPath)}" alt="${escapeHtml(`${record.routePattern} ${record.state}`)}"></a><h2>${escapeHtml(record.routePattern)}</h2><p>${escapeHtml(`${record.imageId} · ${record.persona} · ${record.theme} · ${record.viewport} · ${record.state}`)}</p></article>`,
    )
    .join("");
  const areas = Object.keys(byArea)
    .sort()
    .map((area) => `<option>${escapeHtml(area)}</option>`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Voyagewright Brightwork Experience Images</title><style>body{margin:0;background:#07111b;color:#f6f1e4;font-family:system-ui;padding:24px}header{max-width:1200px;margin:auto}select{margin:6px;padding:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;margin-top:24px}article{background:#132235;border:1px solid #46627d;border-radius:12px;padding:12px}img{width:100%;height:180px;object-fit:contain;background:#05090f}h2{font-size:15px}p{font-size:12px;color:#c6d4df;overflow-wrap:anywhere}.hidden{display:none}</style></head><body><header><h1>Voyagewright Brightwork Experience Images</h1><p>Source <code>${manifest.sourceSha}</code> · ${manifest.records.length} current synthetic captures · pending Brightwork review.</p><label>Area <select id="area"><option>All</option>${areas}</select></label><label>Theme <select id="theme"><option>All</option><option>DARK</option><option>LIGHT</option></select></label><label>Viewport <select id="viewport"><option>All</option><option>desktop</option><option>mobile</option></select></label></header><main>${cards}</main><script>for(const id of ['area','theme','viewport'])document.getElementById(id).addEventListener('change',filter);function filter(){for(const item of document.querySelectorAll('article'))item.classList.toggle('hidden',(area.value!=='All'&&item.dataset.area!==area.value)||(theme.value!=='All'&&item.dataset.theme!==theme.value)||(viewport.value!=='All'&&!item.dataset.viewport.startsWith(viewport.value)))}</script></body></html>`;
  await writeFile(path.join(output, "index.html"), html, "utf8");
}

function indexRecord(record) {
  return {
    routePattern: record.routePattern,
    screenId: record.screenId,
    imageId: record.imageId,
    screenshotPath: record.screenshotPath,
    contactSheetDirectory: "Contact_Sheets",
  };
}

async function createContactSheets(output, manifest) {
  const routeRecords = manifest.records.filter((record) => record.coverageKind === "ROUTE");
  const all = [
    ["Whole_Product_Desktop", routeRecords.filter((record) => record.viewport.startsWith("desktop"))],
    ["Whole_Product_Mobile", routeRecords.filter((record) => record.viewport.startsWith("mobile"))],
    ["Comparison_Dark_vs_Light", routeRecords.filter((record) => record.theme === "DARK" || record.theme === "LIGHT")],
    ["Comparison_Desktop_vs_Mobile", routeRecords],
    ["Critical_States", manifest.records.filter((record) => record.coverageKind === "STATE")],
  ];
  for (const area of [...new Set(routeRecords.map((record) => record.productArea))].sort())
    all.push([
      `Area_${safeSegment(area)}_Desktop`,
      routeRecords.filter((record) => record.productArea === area && record.viewport.startsWith("desktop")),
    ]);
  await mkdir(path.join(output, "Contact_Sheets"), { recursive: true });
  for (const [prefix, records] of all) await contactSheets(output, manifest.sourceSha, prefix, records);
}

async function contactSheets(output, sourceSha, prefix, records) {
  const chunks = chunk(records, 24);
  for (let index = 0; index < chunks.length; index += 1)
    await contactSheet(output, sourceSha, `${prefix}_${String(index + 1).padStart(2, "0")}.png`, chunks[index]);
}

async function contactSheet(output, sourceSha, fileName, records) {
  if (!records.length) return;
  const columns = Math.min(4, records.length);
  const tileWidth = 360;
  const imageHeight = 205;
  const labelHeight = 64;
  const header = 48;
  const gap = 12;
  const rows = Math.ceil(records.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = header + rows * (imageHeight + labelHeight) + (rows + 1) * gap;
  const composites = [
    {
      input: Buffer.from(
        `<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#102436"/><text x="16" y="29" font-family="Arial" font-size="16" fill="#f6f1e4">${escapeXml(fileName.replace(/\.png$/u, ""))} · ${sourceSha.slice(0, 12)}</text></svg>`,
      ),
      left: 0,
      top: 0,
    },
  ];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const x = gap + (index % columns) * (tileWidth + gap);
    const y = header + gap + Math.floor(index / columns) * (imageHeight + labelHeight + gap);
    const source = path.join(output, ...record.screenshotPath.split("/"));
    const thumbnail = await sharp(source)
      .resize(tileWidth, imageHeight, { fit: "contain", background: "#07111b" })
      .png()
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#172b3d"/><text x="8" y="18" font-family="Arial" font-size="11" fill="#f5f1e6">${escapeXml(record.routePattern.slice(0, 52))}</text><text x="8" y="37" font-family="Arial" font-size="10" fill="#bdd2e6">${escapeXml(`${record.imageId} · ${record.persona} · ${record.state}`.slice(0, 60))}</text><text x="8" y="54" font-family="Arial" font-size="10" fill="#e7be6a">${escapeXml(`${record.theme} · ${record.viewport}`)}</text></svg>`,
    );
    composites.push({ input: thumbnail, left: x, top: y }, { input: label, left: x, top: y + imageHeight });
  }
  await sharp({ create: { width, height, channels: 4, background: "#07111b" } })
    .composite(composites)
    .png()
    .toFile(path.join(output, "Contact_Sheets", fileName));
}

async function writeLimitations(report) {
  const rows =
    report.blocked
      .map((record) => `- \`${record.routePattern}\` ${record.viewport} ${record.theme}: ${record.limitation}`)
      .join("\n") || "- None recorded.";
  const content = `---\ntitle: Brightwork Capture Limitations and Blockers\naudience: engineering-evidence\nstatus: current\ncanonical_for: brightwork-capture-limitations\nlast_reviewed: ${new Date().toISOString().slice(0, 10)}\n---\n\n# Brightwork Capture Limitations and Blockers\n\nThese captures use task-owned synthetic fixtures. They do not provide deployment, live-provider, real-user, or visual-acceptance evidence.\n\n## Product blockers\n\n${rows}\n`;
  await writeFile(limitationsPath, content, "utf8");
}

async function writeAuditorIndex(manifest, report) {
  const index = await json(path.join(imageRoot, "auditor-index.json"));
  await writeJson(auditorIndexPath, { ...index, reconciliation: summary(report), sourceSha: manifest.sourceSha });
}

async function verifyManifestFiles(output, manifest) {
  const seen = new Set();
  for (const record of manifest.records) {
    if (seen.has(record.imageId)) throw new Error(`BRIGHTWORK_DUPLICATE_IMAGE_ID:${record.imageId}`);
    seen.add(record.imageId);
    const file = path.join(output, ...record.screenshotPath.split("/"));
    if (!(await isNonEmpty(file))) throw new Error(`BRIGHTWORK_IMAGE_MISSING:${record.imageId}`);
    if (fileChecksum(file) !== record.sha256) throw new Error(`BRIGHTWORK_IMAGE_CHECKSUM_MISMATCH:${record.imageId}`);
  }
}

async function removeUnreferencedCanonicalFiles(output, manifest) {
  const canonicalRoot = path.resolve(output, "Canonical");
  const expected = new Set(
    manifest.records.map((record) => {
      if (!record.screenshotPath.startsWith("Canonical/"))
        throw new Error(`BRIGHTWORK_NONCANONICAL_MANIFEST_PATH:${record.imageId}`);
      const file = path.resolve(output, ...record.screenshotPath.split("/"));
      if (!file.startsWith(`${canonicalRoot}${path.sep}`))
        throw new Error(`BRIGHTWORK_CANONICAL_PATH_ESCAPE:${record.imageId}`);
      return file;
    }),
  );
  const actual = await canonicalPngFiles(canonicalRoot);
  const stale = actual.filter((file) => !expected.has(file));
  await Promise.all(stale.map((file) => rm(file, { force: false })));
  return stale.map((file) => path.relative(output, file).replaceAll("\\", "/"));
}

async function canonicalPngFiles(directory) {
  const { readdir } = await import("node:fs/promises");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await canonicalPngFiles(candidate)));
    else if (entry.isFile() && entry.name.endsWith(".png")) files.push(candidate);
  }
  return files;
}

async function copyDirectory(from, to) {
  await mkdir(to, { recursive: true });
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDirectory(source, destination);
    else await (await import("node:fs/promises")).copyFile(source, destination);
  }
}

function buildReadme(manifest) {
  return `# Voyagewright Brightwork Experience Images\n\nThis canonical evidence corpus is source-bound to \`${manifest.sourceSha}\`, capture-contract digest \`${manifest.contractDigest}\`, and the \`${manifest.fixture}\` task-owned synthetic fixture. It contains ${manifest.records.length} captures, all marked \`${CURRENT_CAPTURE_STATUS}\`.\n\nOpen [index.html](index.html) for the auditor index. Contact sheets are under [Contact_Sheets](Contact_Sheets). Captures are evidence awaiting later Brightwork review, not visual acceptance, owner acceptance, live-provider, deployment, or production-data proof.\n`;
}

function summary(report) {
  return {
    sourceSha: report.sourceSha,
    requiredCaptures: report.requiredCaptures,
    currentCaptures: report.currentCaptures,
    staleCaptures: report.staleCaptures,
    missingCaptures: report.missingCaptures,
    blockedByProduct: report.blockedByProduct,
    orphanedCaptures: report.unexpectedOrphanedCaptures,
    duplicateImageIds: report.duplicateCanonicalImageIds,
    duplicateIdentities: report.duplicateCanonicalIdentities,
    malformedIdentities: report.malformedCanonicalIdentities,
    personaMismatches: report.personaContractMismatches,
    semanticInvalid: report.semanticInvalidCaptures,
    excludedByClassification: report.excludedByClassification,
    completeness: report.overallCompleteness,
  };
}

function nextImageOrdinal(existingRecords, supplementalCount) {
  const highest = existingRecords.reduce((current, record) => {
    const parsed = Number.parseInt(String(record.imageId ?? "").replace(/^BW-XI-/u, ""), 10);
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return highest + supplementalCount + 1;
}

function json(file) {
  return readFile(file, "utf8").then(JSON.parse);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function auditedSourceSha() {
  return auditedSources().productSourceSha;
}

function auditedSources() {
  // Evidence commits may be merged after the product source they describe.
  // Keep ordinary product source and the production-build audit runtime distinct.
  const stageOne = JSON.parse(
    git("show", "HEAD:Development_Docs/Projects/Voyagewright_Brightwork/Current_Route_Census.json"),
  );
  const productSourceSha = stageOne.sourceSha;
  const auditRuntimeSourceSha = git("rev-parse", "HEAD");
  const auditOnlySourcePaths = new Set([
    "src/instrumentation.ts",
    "src/proxy.ts",
    "src/homeport/public-app-origin.ts",
    "src/wayfarer/http.ts",
  ]);
  try {
    const changed = git("diff", "--name-only", productSourceSha, "HEAD", "--", "src")
      .split(/\r?\n/u)
      .filter(Boolean)
      .filter(
        (file) =>
          !file.startsWith("src/audit/") &&
          !file.startsWith("src/app/__audit/") &&
          !file.startsWith("src/app/audit-internal/") &&
          !auditOnlySourcePaths.has(file),
      );
    if (changed.length) throw new Error(`BRIGHTWORK_PRODUCT_SOURCE_BASELINE_MOVED:${productSourceSha}`);
  } catch (error) {
    if (String(error.message ?? error).startsWith("BRIGHTWORK_PRODUCT_SOURCE_BASELINE_MOVED")) throw error;
    throw new Error(`BRIGHTWORK_PRODUCT_SOURCE_BASELINE_CHECK_FAILED:${productSourceSha}`);
  }
  return { productSourceSha, auditRuntimeSourceSha };
}

function sourceBoundFixtureIdentity({ fixtureReceipt, auditReceipt, source }) {
  const fixture = {
    fixtureVersion: fixtureReceipt.fixtureVersion,
    fixtureSourceSha: fixtureReceipt.sourceSha,
    fixtureDatabaseHash: fixtureReceipt.databaseHash,
  };
  const environment = {
    classification: auditReceipt.classification,
    auditRuntimeSourceSha: auditReceipt.sourceSha,
    productSourceSha: auditReceipt.productBaselineSha,
    buildMode: auditReceipt.environment.buildMode,
    deploymentData: auditReceipt.environment.deploymentData,
  };
  return {
    ...fixture,
    ...environment,
    fixtureReceiptDigest: sha256(stableJson(fixture)),
    auditEnvironmentDigest: sha256(stableJson(environment)),
    sourceBindingDigest: sha256(stableJson({ ...source, fixture, environment })),
  };
}

function sqliteUrl(file) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function safeSegment(value) {
  return String(value).replaceAll(/[^A-Za-z0-9_-]+/gu, "_");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function isNonEmpty(file) {
  try {
    return (await stat(file)).size > 100;
  } catch {
    return false;
  }
}

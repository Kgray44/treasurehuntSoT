import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const repositoryRoot = path.resolve(process.cwd());
const outputRoot = path.join(repositoryRoot, "Experience_Images");
const routeInventoryPath = path.join(
  repositoryRoot,
  "Development_Docs",
  "Projects",
  "Project_Homeport",
  "Homeport_Route_Inventory.json",
);
const screenCatalogPath = path.join(
  repositoryRoot,
  "Development_Docs",
  "Projects",
  "Project_Homeport",
  "Homeport_Screen_Catalog.json",
);
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const sourceSha = required("HOMEPORT_EXPERIENCE_IMAGES_SOURCE_SHA").toLowerCase();
const baseUrl = required("HOMEPORT_EXPERIENCE_IMAGES_BASE_URL").replace(/\/$/u, "");
const databasePath = path.resolve(required("HOMEPORT_EXPERIENCE_IMAGES_DATABASE_PATH"));
const handoffPath = path.join(
  taskRoot,
  "credentials",
  "owner-correction-round2-walkthrough-credentials.private.json",
);
const fixture = "homeport-phase7-owner-correction-round2-v1";
const command = process.argv[2] ?? "generate";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const allowedClassifications = new Set([
  "USER_NAVIGABLE",
  "TOKENIZED_DEEP_LINK",
  "REDIRECT_ALIAS",
  "CONTEXTUAL_DYNAMIC",
  "AUTH_COMPATIBILITY_ALIAS",
]);
const requiredDirectories = [
  "Gateway",
  "Authentication",
  "Account",
  "Workspaces",
  "Player",
  "Captain",
  "Creator",
  "Explore",
  "Chronicle",
  "Personal_Harbor",
  "Passport",
  "Community",
  "Recovery",
  "Permission_and_Restrictions",
  "Loading_Empty_and_Errors",
  "Compatibility_and_Tokenized",
];

assertSafeInputs();

if (command === "generate") await generate();
else if (command === "validate") await validate();
else throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_COMMAND_UNKNOWN:${command}`);

async function generate() {
  const currentSha = git("rev-parse", "HEAD").toLowerCase();
  if (currentSha !== sourceSha) throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_SOURCE_MISMATCH:${currentSha}:${sourceSha}`);
  const [routeInventory, screenCatalog, handoff] = await Promise.all([
    json(routeInventoryPath),
    json(screenCatalogPath),
    json(handoffPath),
  ]);
  const routes = routeInventory.routes.filter(
    (entry) => entry.kind === "page" && allowedClassifications.has(entry.classification),
  );
  const criticalityByRoute = new Map();
  for (const screen of screenCatalog.screens)
    for (const routeId of screen.routeIds ?? [])
      criticalityByRoute.set(routeId, screen.phase6Implementation?.criticality ?? "STANDARD");
  const representatives = await representativeValues();
  const concreteRoutes = routes.map((route) => ({
    ...route,
    concreteRoute: resolveRoute(route.routePattern, representatives),
    criticality: criticalityByRoute.get(route.routeId) ?? "STANDARD",
  }));
  const criticalRoutes = concreteRoutes.filter((route) => ["CRITICAL", "HIGH"].includes(route.criticality));

  await rm(outputRoot, { recursive: true, force: true });
  await createStructure();
  await clearCaptureSessions(handoff);
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const records = [];
  try {
    const authStorageState = await authenticatedStorageState(browser, handoff, "SERA");
    await captureGroup(browser, concreteRoutes, records, {
      root: "Desktop",
      theme: "SYSTEM",
      viewportName: "desktop-1440x900",
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
      authStorageState,
    });
    await captureGroup(browser, criticalRoutes, records, {
      root: "Mobile",
      theme: "SYSTEM",
      viewportName: "mobile-390x844",
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      authStorageState,
    });
    for (const theme of ["DARK", "LIGHT"])
      for (const mobile of [false, true])
        await captureGroup(browser, criticalRoutes, records, {
          root: `${theme === "DARK" ? "Dark_Mode" : "Light_Mode"}/${mobile ? "Mobile" : "Desktop"}`,
          theme,
          viewportName: mobile ? "mobile-390x844" : "desktop-1440x900",
          viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
          colorScheme: theme === "DARK" ? "dark" : "light",
          authStorageState,
        });
    await captureRepresentativeStates(browser, records, {
      authStorageState,
      handoff,
    });
  } finally {
    await browser.close();
  }

  const manifest = {
    schemaVersion: "1.0.0",
    project: "Project Homeport",
    artifact: "Phase 7 Owner Walkthrough Correction Round 2 Experience Images",
    fixture,
    sourceSha,
    generatedAt: new Date().toISOString(),
    browser: `Chromium ${browserVersion}`,
    routeCensus: {
      humanFacingRoutes: concreteRoutes.length,
      capturedHumanFacingRoutes: new Set(records.filter((record) => record.coverageKind === "ROUTE").map((record) => record.routePattern)).size,
      excludedDevelopmentOrDiagnosticRoutes: routeInventory.routes
        .filter((entry) => entry.kind === "page" && !allowedClassifications.has(entry.classification))
        .map((entry) => entry.routePattern),
    },
    records,
  };
  await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputRoot, "index.html"), buildIndex(manifest), "utf8");
  await writeFile(path.join(outputRoot, "README.md"), buildReadme(manifest), "utf8");
  await createContactSheets(records);
  await validate();
  process.stdout.write(
    `${JSON.stringify({
      status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_EXPERIENCE_IMAGES_GENERATED",
      sourceSha,
      totalCaptures: records.length,
      humanFacingRoutes: concreteRoutes.length,
      desktop: records.filter((record) => record.viewport.startsWith("desktop")).length,
      mobile: records.filter((record) => record.viewport.startsWith("mobile")).length,
      dark: records.filter((record) => record.theme === "DARK").length,
      light: records.filter((record) => record.theme === "LIGHT").length,
    })}\n`,
  );

  async function captureGroup(browserInstance, groupRoutes, output, options) {
    const auth = await newCaptureContext(browserInstance, { ...options, storageState: options.authStorageState });
    const anonymous = await newCaptureContext(browserInstance, options);
    try {
      await setTheme(auth.page, options.theme);
      for (const route of groupRoutes) {
        const page = needsAnonymous(route) ? anonymous.page : auth.page;
        const accountAlias = needsAnonymous(route) ? "ANONYMOUS" : "SERA";
        await captureRoute(page, route, output, options, accountAlias);
      }
    } finally {
      await Promise.all([auth.context.close(), anonymous.context.close()]);
    }
  }

  async function captureRoute(page, route, output, options, accountAlias) {
    await settledGoto(page, route.concreteRoute);
    const productArea = areaForRoute(route);
    const fileName = `${route.routeId}-${options.theme.toLowerCase()}-${options.viewportName}.png`;
    const relativePath = path.posix.join(options.root, productArea, fileName);
    const absolutePath = path.join(outputRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" });
    output.push(
      await manifestRecord(page, absolutePath, relativePath, {
        imageId: `HP-XI-${String(output.length + 1).padStart(4, "0")}`,
        screenId: `screen-${route.routeId.replace(/^route-/u, "")}`,
        route: route.concreteRoute.split("?")[0],
        routePattern: route.routePattern,
        productArea,
        accountAlias,
        state: "READY",
        theme: options.theme,
        viewport: options.viewportName,
        browserVersion,
        limitation: limitationFor(route),
        coverageKind: "ROUTE",
        criticality: route.criticality,
      }),
    );
  }

  async function captureRepresentativeStates(browserInstance, output, storageStates) {
    const options = {
      root: "Desktop",
      theme: "DARK",
      viewportName: "desktop-1440x900",
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    };
    const auth = await newCaptureContext(browserInstance, { ...options, storageState: storageStates.authStorageState });
    const anonymous = await newCaptureContext(browserInstance, options);
    const restricted = await newCaptureContext(browserInstance, options);
    try {
      await setTheme(auth.page, "DARK");

      await stateCapture(auth.page, output, options, {
        id: "community-empty",
        route: "/community/collections/empty-chart-case",
        routePattern: "/community/collections/[slug]",
        state: "EMPTY",
        productArea: "Loading_Empty_and_Errors",
        accountAlias: "SERA",
      });
      await stateCapture(auth.page, output, options, {
        id: "permission-moderation",
        route: "/community/moderation",
        routePattern: "/community/moderation",
        state: "PERMISSION",
        productArea: "Permission_and_Restrictions",
        accountAlias: "SERA",
      });
      await attemptRestrictedSignIn(restricted.page, storageStates.handoff);
      await screenshotState(restricted.page, output, options, {
        id: "restricted-account",
        route: "/sign-in",
        routePattern: "/sign-in",
        state: "RESTRICTED",
        productArea: "Permission_and_Restrictions",
        accountAlias: "RESTRICTED_ACCOUNT",
      });
      await stateCapture(auth.page, output, options, {
        id: "archived-community-item",
        route: "/community/archived-superseded-chart",
        routePattern: "/community/[slug]",
        state: "ARCHIVED_OR_REMOVED",
        productArea: "Loading_Empty_and_Errors",
        accountAlias: "SERA",
      });
      await stateCapture(anonymous.page, output, options, {
        id: "invalid-reset-token",
        route: "/reset-password?token=owner-review-invalid-token",
        routePattern: "/reset-password",
        state: "TOKEN_INVALID",
        productArea: "Recovery",
        accountAlias: "ANONYMOUS",
      });
      await stateCapture(auth.page, output, options, {
        id: "destructive-warning",
        route: "/account/data",
        routePattern: "/account/data",
        state: "DESTRUCTIVE_WARNING",
        productArea: "Account",
        accountAlias: "SERA",
      });

      await settledGoto(auth.page, "/community/chronicles");
      const search = auth.page.getByRole("searchbox", { name: "Search public Community Harbor" });
      await search.fill("no-owner-review-match-expected");
      await search.press("Enter");
      await auth.page.getByRole("heading", { name: "No public charts match these criteria" }).waitFor();
      await screenshotState(auth.page, output, options, {
        id: "community-no-results",
        route: "/community/chronicles",
        routePattern: "/community/chronicles",
        state: "NO_RESULTS",
        productArea: "Loading_Empty_and_Errors",
        accountAlias: "SERA",
      });

      await settledGoto(auth.page, "/community/chronicles");
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      await auth.page.route("**/api/community/discover?**", async (route) => {
        await gate;
        await route.continue();
      });
      const slowSearch = auth.page.getByRole("searchbox", { name: "Search public Community Harbor" });
      await slowSearch.fill("coast");
      const pending = slowSearch.press("Enter");
      await auth.page.locator(".ui-loading-state").waitFor({ timeout: 3_000 });
      await screenshotState(auth.page, output, options, {
        id: "community-delayed-loading",
        route: "/community/chronicles",
        routePattern: "/community/chronicles",
        state: "LOADING",
        productArea: "Loading_Empty_and_Errors",
        accountAlias: "SERA",
      });
      release();
      await pending;
      await auth.page.unroute("**/api/community/discover?**");

      await settledGoto(auth.page, "/community/chronicles");
      await auth.page.route("**/api/community/discover?**", async (route) =>
        route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) }),
      );
      const errorSearch = auth.page.getByRole("searchbox", { name: "Search public Community Harbor" });
      await errorSearch.fill("dependency-test");
      await errorSearch.press("Enter");
      await auth.page.locator(".community-state--error").waitFor();
      await screenshotState(auth.page, output, options, {
        id: "community-real-error",
        route: "/community/chronicles",
        routePattern: "/community/chronicles",
        state: "REAL_ERROR",
        productArea: "Loading_Empty_and_Errors",
        accountAlias: "SERA",
      });
      await auth.page.unroute("**/api/community/discover?**");
    } finally {
      await signOut(auth.page);
      await Promise.all([auth.context.close(), anonymous.context.close(), restricted.context.close()]);
    }

    async function stateCapture(page, outputRecords, captureOptions, state) {
      await settledGoto(page, state.route);
      await screenshotState(page, outputRecords, captureOptions, state);
    }

    async function screenshotState(page, outputRecords, captureOptions, state) {
      const fileName = `state-${state.id}-${captureOptions.viewportName}.png`;
      const relativePath = path.posix.join("Desktop", state.productArea, fileName);
      const absolutePath = path.join(outputRoot, ...relativePath.split("/"));
      await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" });
      outputRecords.push(
        await manifestRecord(page, absolutePath, relativePath, {
          imageId: `HP-XI-${String(outputRecords.length + 1).padStart(4, "0")}`,
          screenId: `screen-state-${state.id}`,
          route: state.route.split("?")[0],
          routePattern: state.routePattern,
          productArea: state.productArea,
          accountAlias: state.accountAlias,
          state: state.state,
          theme: captureOptions.theme,
          viewport: captureOptions.viewportName,
          browserVersion,
          limitation: "Synthetic fixture state captured for owner review; not live-provider evidence.",
          coverageKind: "STATE",
          criticality: "HIGH",
        }),
      );
    }
  }
}

async function validate() {
  const [manifest, routeInventory] = await Promise.all([
    json(path.join(outputRoot, "manifest.json")),
    json(routeInventoryPath),
  ]);
  const errors = [];
  if (manifest.sourceSha !== sourceSha) errors.push(`source-sha:${manifest.sourceSha}:${sourceSha}`);
  const expectedRoutes = routeInventory.routes.filter(
    (entry) => entry.kind === "page" && allowedClassifications.has(entry.classification),
  );
  const capturedPatterns = new Set(
    manifest.records.filter((record) => record.coverageKind === "ROUTE").map((record) => record.routePattern),
  );
  for (const route of expectedRoutes) if (!capturedPatterns.has(route.routePattern)) errors.push(`missing-route:${route.routePattern}`);
  for (const record of manifest.records) {
    if (record.route.startsWith("/api")) errors.push(`api-route:${record.imageId}`);
    if (record.sourceSha !== sourceSha) errors.push(`record-source:${record.imageId}`);
    if (!/^[A-Z0-9_]+$/u.test(record.accountAlias)) errors.push(`account-alias:${record.imageId}`);
    const absolutePath = path.join(outputRoot, ...record.screenshotPath.split("/"));
    try {
      if ((await sha256(absolutePath)) !== record.sha256) errors.push(`checksum:${record.imageId}`);
      if ((await stat(absolutePath)).size < 1_000) errors.push(`image-too-small:${record.imageId}`);
    } catch {
      errors.push(`missing-image:${record.imageId}`);
    }
  }
  const criticalRecords = manifest.records.filter(
    (record) => record.coverageKind === "ROUTE" && ["CRITICAL", "HIGH"].includes(record.criticality),
  );
  const criticalPatterns = new Set(criticalRecords.map((record) => record.routePattern));
  for (const routePattern of criticalPatterns) {
    const records = criticalRecords.filter((record) => record.routePattern === routePattern);
    for (const theme of ["DARK", "LIGHT"])
      for (const viewport of ["desktop", "mobile"])
        if (!records.some((record) => record.theme === theme && record.viewport.startsWith(viewport)))
          errors.push(`critical-coverage:${routePattern}:${theme}:${viewport}`);
  }
  const states = new Set(manifest.records.filter((record) => record.coverageKind === "STATE").map((record) => record.state));
  for (const state of [
    "LOADING",
    "EMPTY",
    "NO_RESULTS",
    "REAL_ERROR",
    "PERMISSION",
    "RESTRICTED",
    "ARCHIVED_OR_REMOVED",
    "TOKEN_INVALID",
    "DESTRUCTIVE_WARNING",
  ])
    if (!states.has(state)) errors.push(`missing-state:${state}`);
  for (const relative of [
    "README.md",
    "manifest.json",
    "index.html",
    "Contact_Sheets/Master_Desktop.png",
    "Contact_Sheets/Master_Mobile.png",
    "Contact_Sheets/Master_Light_Mode.png",
    "Contact_Sheets/Master_Dark_Mode.png",
  ])
    try {
      if ((await stat(path.join(outputRoot, ...relative.split("/")))).size < 1) errors.push(`empty-artifact:${relative}`);
    } catch {
      errors.push(`missing-artifact:${relative}`);
    }
  const searchable = `${JSON.stringify(manifest)}\n${await readFile(path.join(outputRoot, "index.html"), "utf8")}`;
  for (const forbidden of ["password", "csrfToken", "sessionCookie", "resetToken", "providerSecret"])
    if (new RegExp(`\\"${forbidden}\\"\\s*:`, "iu").test(searchable)) errors.push(`private-marker:${forbidden}`);
  if (errors.length) throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_INVALID\n${errors.join("\n")}`);
  process.stdout.write(
    `${JSON.stringify({
      status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_EXPERIENCE_IMAGES_VALID",
      sourceSha,
      totalCaptures: manifest.records.length,
      humanFacingRoutes: expectedRoutes.length,
      missingPages: 0,
      checksumFailures: 0,
      criticalCoverageFailures: 0,
      privacyFindings: 0,
    })}\n`,
  );
}

async function representativeValues() {
  const db = new PrismaClient({ datasources: { db: { url: `file:${databasePath.replaceAll("\\", "/")}` } } });
  try {
    const [chronicle, listing, collection, creator, guide, voyageLog, moderationCase, artifact, history, session] =
      await Promise.all([
        db.chronicle.findFirst({ where: { status: "PUBLISHED" }, orderBy: { id: "asc" } }),
        db.communityListing.findFirst({
          where: { publicationStatus: "PUBLISHED", moderationStatus: "ACTIVE", visibility: { in: ["COMMUNITY", "FEATURED"] } },
          orderBy: { id: "asc" },
        }),
        db.communityCollection.findFirst({ where: { visibility: { in: ["COMMUNITY", "FEATURED"] } }, orderBy: { id: "asc" } }),
        db.communityProfile.findFirst({
          where: { visibility: { in: ["COMMUNITY", "FEATURED"] }, moderationStatus: "ACTIVE" },
          orderBy: { id: "asc" },
        }),
        db.communityGuideContent.findFirst({ where: { status: "PUBLISHED" }, orderBy: { id: "asc" } }),
        db.communityVoyageLog.findFirst({ where: { visibility: { in: ["COMMUNITY", "FEATURED"] } }, orderBy: { id: "asc" } }),
        db.communityModerationCase.findFirst({ orderBy: { id: "asc" } }),
        db.playerArtifactRecord.findFirst({ orderBy: { id: "asc" } }),
        db.playerChronicleRecord.findFirst({ orderBy: { id: "asc" } }),
        db.taleSession.findFirst({ orderBy: { id: "asc" }, include: { tale: true } }),
      ]);
    const values = {
      taleId: chronicle?.id,
      taleSlug: chronicle?.slug,
      campaignSlug: chronicle?.slug,
      listingSlug: listing?.slug,
      collectionSlug: collection?.slug,
      handle: creator?.handle,
      guideSlug: guide?.slug,
      voyageLogSlug: voyageLog?.slug,
      voyageLogId: voyageLog?.id,
      moderationId: moderationCase?.id,
      artifactId: artifact?.id,
      recordId: history?.id,
      sessionId: session?.id,
      playthroughId: session?.id,
      playerTaleSlug: session?.tale?.slug ?? chronicle?.slug,
    };
    for (const [key, value] of Object.entries(values)) if (!value) throw new Error(`HOMEPORT_EXPERIENCE_REPRESENTATIVE_MISSING:${key}`);
    return values;
  } finally {
    await db.$disconnect();
  }
}

async function clearCaptureSessions(handoff) {
  const accountIds = [handoff.accounts.SERA?.accountId, handoff.accounts.RESTRICTED_ACCOUNT?.accountId].filter(Boolean);
  if (accountIds.length !== 2) throw new Error("HOMEPORT_EXPERIENCE_CAPTURE_ACCOUNT_IDS_MISSING");
  const db = new PrismaClient({ datasources: { db: { url: `file:${databasePath.replaceAll("\\", "/")}` } } });
  try {
    await db.accountSession.deleteMany({ where: { accountId: { in: accountIds } } });
  } finally {
    await db.$disconnect();
  }
}

function resolveRoute(pattern, values) {
  let route = pattern;
  const replacements = {
    "[sessionId]": values.sessionId,
    "[playthroughId]": values.playthroughId,
    "[taleId]": values.taleId,
    "[taleSlug]": pattern.startsWith("/play/") ? values.playerTaleSlug : values.taleSlug,
    "[campaignSlug]": values.campaignSlug,
    "[artifactId]": values.artifactId,
    "[recordId]": values.recordId,
    "[handle]": values.handle,
    "[workspace]": "dashboard",
    "[token]": "owner-review-invalid-token",
  };
  for (const [placeholder, value] of Object.entries(replacements)) route = route.replaceAll(placeholder, encodeURIComponent(value));
  if (route.includes("[slug]")) {
    const value = route.startsWith("/community/collections/")
      ? values.collectionSlug
      : route.startsWith("/community/guides/")
        ? values.guideSlug
        : route.startsWith("/community/voyage-logs/")
          ? values.voyageLogSlug
          : values.listingSlug;
    route = route.replaceAll("[slug]", encodeURIComponent(value));
  }
  if (route.includes("[id]"))
    route = route.replaceAll(
      "[id]",
      encodeURIComponent(route.startsWith("/community/moderation/") ? values.moderationId : values.voyageLogId),
    );
  if (/\[[^\]]+\]/u.test(route)) throw new Error(`HOMEPORT_EXPERIENCE_ROUTE_UNRESOLVED:${pattern}:${route}`);
  return route;
}

async function newCaptureContext(browser, options) {
  const context = await browser.newContext({
    viewport: options.viewport,
    colorScheme: options.colorScheme,
    reducedMotion: "reduce",
    locale: "en-US",
    storageState: options.storageState,
  });
  await context.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("chronicle-role-gateway", "seen");
      localStorage.setItem(
        "voyagewright-theme-bootstrap-v1",
        JSON.stringify({ theme, contrast: "STANDARD", textScale: 1, motion: "REDUCED" }),
      );
    },
    { theme: options.theme },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return { context, page };
}

async function authenticatedStorageState(browser, handoff, alias) {
  const capture = await newCaptureContext(browser, {
    theme: "SYSTEM",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  try {
    await signIn(capture.page, handoff, alias);
    return await capture.context.storageState();
  } finally {
    await capture.context.close();
  }
}

async function signIn(page, handoff, alias) {
  const account = handoff.accounts[alias];
  if (!account) throw new Error(`HOMEPORT_EXPERIENCE_ACCOUNT_ALIAS_MISSING:${alias}`);
  await settledGoto(page, "/sign-in");
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  let context = { status: "anonymous" };
  for (let attempt = 0; attempt < 50 && ["anonymous", "loading"].includes(context.status); attempt += 1) {
    await page.waitForTimeout(100);
    context = await page.evaluate(async () =>
      fetch("/api/auth/context", { cache: "no-store" }).then((response) => response.json()),
    );
  }
  if (["anonymous", "loading", "unavailable"].includes(context.status))
    throw new Error(`HOMEPORT_EXPERIENCE_SIGN_IN_FAILED:${alias}:${context.status}`);
}

async function attemptRestrictedSignIn(page, handoff) {
  const account = handoff.accounts.RESTRICTED_ACCOUNT;
  if (!account) throw new Error("HOMEPORT_EXPERIENCE_RESTRICTED_ALIAS_MISSING");
  await settledGoto(page, "/sign-in");
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password").fill(handoff.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(/credentials were not accepted|restricted|unavailable|cannot sign in/iu).waitFor();
}

async function signOut(page) {
  await page
    .evaluate(async () => {
      await fetch("/api/auth/sign-out", { method: "POST" });
    })
    .catch(() => undefined);
}

async function setTheme(page, theme) {
  await settledGoto(page, "/account/preferences");
  await page.getByRole("combobox", { name: "Theme", exact: true }).last().selectOption(theme);
  await page.getByRole("button", { name: "Save preferences" }).last().click();
  const expected = theme === "SYSTEM" ? /^(dark|light)$/u : new RegExp(`^${theme.toLowerCase()}$`, "u");
  await page.locator("html").waitFor();
  await page.waitForFunction(
    ({ source }) => new RegExp(source, "u").test(document.documentElement.dataset.voyageTheme ?? ""),
    { source: expected.source },
  );
}

async function settledGoto(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("body").waitFor();
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(260);
}

function needsAnonymous(route) {
  return (
    route.authenticationRequirement === "BOUNDED_TOKEN_OR_CODE" ||
    /^\/(sign-in|register|forgot-password|reset-password|verify-email|join\/)/u.test(route.routePattern) ||
    /\/(sign-in)$/u.test(route.routePattern)
  );
}

function areaForRoute(route) {
  const value = route.routePattern;
  if (route.classification === "AUTH_COMPATIBILITY_ALIAS" || route.classification === "REDIRECT_ALIAS")
    return "Compatibility_and_Tokenized";
  if (route.classification === "TOKENIZED_DEEP_LINK") return "Recovery";
  if (value === "/") return "Gateway";
  if (/^\/(sign-in|register|forgot-password|reset-password|verify-email|join\/)/u.test(value)) return "Authentication";
  if (value.startsWith("/community")) return "Community";
  if (value.startsWith("/passport")) return "Passport";
  if (value.startsWith("/account")) return "Personal_Harbor";
  if (value.startsWith("/studio")) return "Creator";
  if (value.startsWith("/captain")) return "Captain";
  if (value.startsWith("/player") || value.startsWith("/play/")) return "Player";
  if (value.startsWith("/chronicles")) return "Chronicle";
  if (value.startsWith("/tales")) return "Explore";
  if (["/player", "/captain", "/studio"].includes(value)) return "Workspaces";
  return "Account";
}

function limitationFor(route) {
  if (route.classification === "TOKENIZED_DEEP_LINK") return "Deterministic invalid-token state; no usable secret is captured.";
  if (route.classification === "REDIRECT_ALIAS" || route.classification === "AUTH_COMPATIBILITY_ALIAS")
    return "Compatibility entry may settle on its canonical destination.";
  if (route.classification === "CONTEXTUAL_DYNAMIC") return "One representative eligible synthetic fixture record is captured.";
  return "Synthetic owner-review fixture; not deployment or live-provider proof.";
}

async function manifestRecord(page, absolutePath, relativePath, record) {
  return {
    imageId: record.imageId,
    screenId: record.screenId,
    route: record.route,
    routePattern: record.routePattern,
    pageTitle: (await page.title()).replaceAll(/\s+/gu, " ").trim() || "Voyagewright",
    productArea: record.productArea,
    accountAlias: record.accountAlias,
    fixture,
    state: record.state,
    theme: record.theme,
    viewport: record.viewport,
    browserVersion: `Chromium ${record.browserVersion}`,
    sourceSha,
    capturedAt: new Date().toISOString(),
    screenshotPath: relativePath,
    sha256: await sha256(absolutePath),
    limitation: record.limitation,
    visualReviewStatus: "PENDING_HUMAN_VISUAL_REVIEW",
    coverageKind: record.coverageKind,
    criticality: record.criticality,
    privacyBasis: "Synthetic fixture aliases only; credentials, cookies, tokens, private prose, and object keys are excluded.",
  };
}

async function createStructure() {
  for (const root of ["Desktop", "Mobile"])
    for (const directory of requiredDirectories) await mkdir(path.join(outputRoot, root, directory), { recursive: true });
  for (const theme of ["Light_Mode", "Dark_Mode"])
    for (const viewport of ["Desktop", "Mobile"])
      for (const directory of requiredDirectories)
        await mkdir(path.join(outputRoot, theme, viewport, directory), { recursive: true });
  await mkdir(path.join(outputRoot, "Contact_Sheets"), { recursive: true });
}

async function createContactSheets(records) {
  const baseDesktop = records.filter((record) => record.coverageKind === "ROUTE" && record.theme === "SYSTEM" && record.viewport.startsWith("desktop"));
  const baseMobile = records.filter((record) => record.coverageKind === "ROUTE" && record.theme === "SYSTEM" && record.viewport.startsWith("mobile"));
  const light = records.filter((record) => record.theme === "LIGHT");
  const dark = records.filter((record) => record.theme === "DARK");
  await contactSheet(baseDesktop, "Master_Desktop.png");
  await contactSheet(baseMobile, "Master_Mobile.png");
  await contactSheet(light, "Master_Light_Mode.png");
  await contactSheet(dark, "Master_Dark_Mode.png");
  for (const area of [...new Set(baseDesktop.map((record) => record.productArea))].sort())
    await contactSheet(baseDesktop.filter((record) => record.productArea === area), `${area}.png`);
}

async function contactSheet(records, fileName) {
  if (records.length === 0) return;
  const columns = Math.min(5, records.length);
  const tileWidth = 300;
  const imageHeight = 170;
  const labelHeight = 58;
  const gap = 12;
  const rows = Math.ceil(records.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * (imageHeight + labelHeight) + (rows + 1) * gap;
  const composites = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const x = gap + (index % columns) * (tileWidth + gap);
    const y = gap + Math.floor(index / columns) * (imageHeight + labelHeight + gap);
    const source = path.join(outputRoot, ...record.screenshotPath.split("/"));
    const thumbnail = await sharp(source)
      .resize(tileWidth, imageHeight, { fit: "contain", background: "#0b1220" })
      .png()
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#172033"/><text x="8" y="19" font-family="Arial" font-size="12" fill="#f5f1e6">${escapeXml(record.screenId.slice(0, 42))}</text><text x="8" y="38" font-family="Arial" font-size="11" fill="#b8c5d6">${escapeXml(record.routePattern.slice(0, 48))}</text><text x="8" y="53" font-family="Arial" font-size="10" fill="#d6b25e">${escapeXml(`${record.theme} · ${record.viewport}`)}</text></svg>`,
    );
    composites.push({ input: thumbnail, left: x, top: y }, { input: label, left: x, top: y + imageHeight });
  }
  await sharp({ create: { width, height, channels: 4, background: "#070b12" } })
    .composite(composites)
    .png()
    .toFile(path.join(outputRoot, "Contact_Sheets", fileName));
}

function buildReadme(manifest) {
  return `# Project Homeport Experience Images\n\nThis owner-review library is source-bound to \`${manifest.sourceSha}\` and fixture \`${manifest.fixture}\`. It contains ${manifest.records.length} synthetic captures covering ${manifest.routeCensus.humanFacingRoutes} current human-facing route patterns plus representative loading, empty, error, permission, restricted, archived, token, and destructive-warning states.\n\nOpen [index.html](index.html) directly in a browser. Contact sheets are under [Contact_Sheets](Contact_Sheets). Codex visual review is not owner acceptance. Live email delivery, live external providers, deployment, merge, and production data are not represented.\n`;
}

function buildIndex(manifest) {
  const rows = manifest.records
    .map(
      (record) => `<article data-area="${escapeHtml(record.productArea)}" data-theme="${record.theme}" data-viewport="${record.viewport}" data-state="${record.state}"><a href="${encodeURI(record.screenshotPath)}"><img loading="lazy" src="${encodeURI(record.screenshotPath)}" alt="${escapeHtml(record.screenId)} at ${escapeHtml(record.routePattern)}"></a><h2>${escapeHtml(record.screenId)}</h2><p><code>${escapeHtml(record.routePattern)}</code></p><p>${record.theme} · ${record.viewport} · ${record.state}</p></article>`,
    )
    .join("\n");
  const areas = [...new Set(manifest.records.map((record) => record.productArea))]
    .sort()
    .map((area) => `<option>${escapeHtml(area)}</option>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Project Homeport Experience Images</title><style>body{margin:0;background:#07111b;color:#f6f1e4;font-family:system-ui;padding:24px}header{max-width:1100px;margin:auto}select{margin:6px;padding:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px}article{background:#132235;border:1px solid #46627d;border-radius:12px;padding:12px}img{width:100%;height:180px;object-fit:contain;background:#05090f}h2{font-size:15px}p{font-size:12px;color:#c6d4df;overflow-wrap:anywhere}.hidden{display:none}</style></head><body><header><h1>Project Homeport Experience Images</h1><p>Source <code>${manifest.sourceSha}</code> · ${manifest.records.length} captures · synthetic fixture only.</p><label>Area <select id="area"><option>All</option>${areas}</select></label><label>Theme <select id="theme"><option>All</option><option>SYSTEM</option><option>DARK</option><option>LIGHT</option></select></label><label>Viewport <select id="viewport"><option>All</option><option>desktop</option><option>mobile</option></select></label></header><main>${rows}</main><script>for(const id of ['area','theme','viewport'])document.getElementById(id).addEventListener('change',filter);function filter(){for(const item of document.querySelectorAll('article'))item.classList.toggle('hidden',(area.value!=='All'&&item.dataset.area!==area.value)||(theme.value!=='All'&&item.dataset.theme!==theme.value)||(viewport.value!=='All'&&!item.dataset.viewport.startsWith(viewport.value)))}</script></body></html>`;
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
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

function assertSafeInputs() {
  const expectedOutput = path.join(repositoryRoot, "Experience_Images");
  if (outputRoot !== expectedOutput || path.dirname(outputRoot) !== repositoryRoot)
    throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_OUTPUT_REFUSED:${outputRoot}`);
  if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
    throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_TASK_ROOT_REFUSED:${taskRoot}`);
  if (databasePath === canonicalDatabase || !databasePath.startsWith(`${taskRoot}${path.sep}`))
    throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_DATABASE_REFUSED:${databasePath}`);
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) throw new Error(`HOMEPORT_EXPERIENCE_IMAGES_SOURCE_INVALID:${sourceSha}`);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

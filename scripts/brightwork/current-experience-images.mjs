import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import {
  CURRENT_CAPTURE_STATUS,
  REQUIRED_VIEWPORTS,
  buildCaptureContract,
  buildRouteCensus,
  fileChecksum,
  reconciliationReport,
  requirementIdentity,
  sha256,
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
else if (command === "render") await render();
else if (command === "reconcile") await reconcile();
else if (command === "validate") await validate();
else if (command === "complete") await complete();
else throw new Error(`BRIGHTWORK_COMMAND_UNKNOWN:${command}`);

async function plan() {
  const sourceSha = git("rev-parse", "HEAD");
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
    `${JSON.stringify({ status: "BRIGHTWORK_CAPTURE_PLAN_READY", sourceSha, routes: census.totals, requiredCaptures: contract.requirements.length })}\n`,
  );
}

async function capture() {
  const contract = await json(contractPath);
  const sourceSha = git("rev-parse", "HEAD");
  if (contract.sourceSha !== sourceSha) throw new Error("BRIGHTWORK_CAPTURE_PLAN_STALE_REPLAN_REQUIRED");
  const baseUrl = required("BRIGHTWORK_BASE_URL").replace(/\/$/u, "");
  const fixtureRoot = path.resolve(required("BRIGHTWORK_FIXTURE_ROOT"));
  const fixtureReceipt = await json(path.join(fixtureRoot, "reports", "fixture-receipt.json"));
  if (fixtureReceipt.sourceSha !== sourceSha) throw new Error("BRIGHTWORK_FIXTURE_SOURCE_MISMATCH");
  const credentials = await loadCredentials(fixtureReceipt.credentials);
  const representatives = await representativeValues(fixtureReceipt.databasePath, credentials);
  const temporaryRoot = path.join(fixtureRoot, "capture-output");
  const temporaryImages = path.join(temporaryRoot, "Experience_Images");
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryImages, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const records = [];
  try {
    const byContext = new Map();
    for (const requirement of contract.requirements) {
      const key = `${requirement.persona}|${requirement.theme}|${requirement.viewport}`;
      const group = byContext.get(key) ?? [];
      group.push(requirement);
      byContext.set(key, group);
    }
    for (const [key, requirements] of byContext) {
      const [persona, theme, viewportName] = key.split("|");
      const viewport = REQUIRED_VIEWPORTS.find((candidate) => candidate.id === viewportName);
      if (!viewport) throw new Error(`BRIGHTWORK_VIEWPORT_UNKNOWN:${viewportName}`);
      const state = await storageState(browser, credentials, persona);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme === "LIGHT" ? "light" : "dark",
        reducedMotion: "reduce",
        locale: "en-US",
        storageState: state,
      });
      await context.addInitScript(
        ({ value }) => {
          sessionStorage.setItem("chronicle-role-gateway", "seen");
          localStorage.setItem(
            "voyagewright-theme-bootstrap-v1",
            JSON.stringify({ theme: value, contrast: "STANDARD", textScale: 1, motion: "REDUCED" }),
          );
        },
        { value: theme },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      try {
        for (const requirement of requirements)
          records.push(
            await captureRequirement({
              page,
              requirement,
              temporaryImages,
              sourceSha,
              contract,
              fixtureReceipt,
              browserVersion,
              representatives,
              ordinal: records.length + 1,
              baseUrl,
            }),
          );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const manifest = {
    schemaVersion: "2.0.0",
    project: "Voyagewright",
    artifact: "Brightwork Stage 1 current visual evidence corpus",
    fixture: fixtureReceipt.fixtureVersion,
    fixturePrivacyBasis: fixtureReceipt.privacyBasis,
    sourceSha,
    contractDigest: contract.contractDigest,
    generatedAt: new Date().toISOString(),
    browser: `Chromium ${browserVersion}`,
    visualReviewStatus: CURRENT_CAPTURE_STATUS,
    records,
  };
  await writeJson(path.join(temporaryImages, "manifest.json"), manifest);
  await createIndex(temporaryImages, manifest);
  await createContactSheets(temporaryImages, manifest);
  await writeFile(path.join(temporaryImages, "README.md"), buildReadme(manifest), "utf8");
  await verifyManifestFiles(temporaryImages, manifest);
  await rm(imageRoot, { recursive: true, force: true });
  await mkdir(path.dirname(imageRoot), { recursive: true });
  await copyDirectory(temporaryImages, imageRoot);
  await reconcile();
  process.stdout.write(
    `${JSON.stringify({ status: "BRIGHTWORK_CURRENT_EXPERIENCE_IMAGES_CAPTURED", sourceSha, captures: records.length, blocked: records.filter((record) => record.captureStatus === "BLOCKED_BY_PRODUCT").length })}\n`,
  );
}

async function render() {
  const manifest = await json(path.join(imageRoot, "manifest.json"));
  await rm(path.join(imageRoot, "Contact_Sheets"), { recursive: true, force: true });
  await createIndex(imageRoot, manifest);
  await createContactSheets(imageRoot, manifest);
  await writeFile(path.join(imageRoot, "README.md"), buildReadme(manifest), "utf8");
  await verifyManifestFiles(imageRoot, manifest);
  const report = await reconcile();
  process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_CONTACT_SHEETS_RENDERED", ...summary(report) })}\n`);
}

async function captureRequirement(options) {
  const {
    page,
    requirement,
    temporaryImages,
    sourceSha,
    contract,
    fixtureReceipt,
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
  let pageTitle = "Voyagewright";
  let captureStatus = CURRENT_CAPTURE_STATUS;
  let limitation = "Synthetic, task-owned fixture evidence. Capture exists for later Brightwork audit; it is not visual acceptance, owner acceptance, deployment, or live-provider proof.";
  let cleanup = async () => undefined;
  try {
    const prepared = await navigateForRequirement(page, `${baseUrl}${concreteRoute}`, requirement);
    cleanup = prepared.cleanup;
    const { response } = prepared;
    if (response && response.status() >= 500) throw new Error(`HTTP_${response.status()}`);
    pageTitle = (await page.title()).replaceAll(/\s+/gu, " ").trim() || "Voyagewright";
    await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" });
    await cleanup();
  } catch (error) {
    await cleanup().catch(() => undefined);
    captureStatus = "BLOCKED_BY_PRODUCT";
    limitation = `Blocked by current product while capturing a synthetic representative instance: ${String(error.message ?? error).slice(0, 240)}`;
    await page.screenshot({ path: absolutePath, fullPage: true, animations: "disabled" }).catch(() => undefined);
    if (!(await isNonEmpty(absolutePath))) await sharp({ create: { width: 800, height: 400, channels: 4, background: "#321418" } }).png().toFile(absolutePath);
  }
  return {
    imageId,
    routeId: requirement.routeId,
    route: concreteRoute.split("?")[0],
    routePattern: requirement.routePattern,
    screenId: requirement.screenId,
    productArea: requirement.productArea,
    state: requirement.state,
    persona: requirement.persona,
    accountAlias: requirement.persona,
    fixture: fixtureReceipt.fixtureVersion,
    theme: requirement.theme,
    viewport: requirement.viewport,
    motionMode: requirement.motionMode,
    browserVersion: `Chromium ${browserVersion}`,
    sourceSha,
    contractDigest: contract.contractDigest,
    capturedAt: new Date().toISOString(),
    screenshotPath: relativePath,
    sha256: fileChecksum(absolutePath),
    coverageKind: requirement.coverageKind,
    criticality: requirement.criticality,
    captureStatus,
    limitation,
    privacyBasis: "Synthetic fixture aliases only; credentials, tokens, private prose, media objects, and raw identifiers are excluded from the corpus.",
    visualReviewStatus: CURRENT_CAPTURE_STATUS,
    pageTitle,
  };
}

async function navigateForRequirement(page, url, requirement) {
  if (requirement.captureAction === "COMMUNITY_LOADING") {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/community/discover?**", async (request) => {
      await gate;
      await request.continue();
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
      request.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) }),
    );
    const response = await settledGoto(page, url);
    const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
    await search.fill("brightwork-error-state");
    await search.press("Enter");
    await page.locator(".community-state--error").waitFor({ timeout: 5_000 });
    return { response, cleanup: () => page.unroute("**/api/community/discover?**") };
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
  const [contract, manifest, census] = await Promise.all([json(contractPath), json(path.join(imageRoot, "manifest.json")), json(censusPath)]);
  const report = reconciliationReport({ contract, manifest, sourceSha: git("rev-parse", "HEAD"), imageRoot });
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
  if (failures.length) throw new Error(`BRIGHTWORK_VISUAL_EVIDENCE_INVALID:${failures.join(",")}`);
  process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_VISUAL_EVIDENCE_VALID", ...summary(report) })}\n`);
}

async function complete() {
  const report = await reconcile();
  const sourceSha = git("rev-parse", "HEAD");
  const status = report.blockedByProduct ? "BRIGHTWORK STAGE 1 — VISUAL EVIDENCE READY WITH PRODUCT BLOCKERS" : "BRIGHTWORK STAGE 1 — CURRENT VISUAL EVIDENCE READY";
  const record = `---\ntitle: Brightwork Stage 1 Completion Record\naudience: engineering-evidence\nstatus: current\ncanonical_for: brightwork-stage-1-completion\nlast_reviewed: ${new Date().toISOString().slice(0, 10)}\n---\n\n# Brightwork Stage 1 Completion Record\n\nStatus: **${status}**\n\n- Source SHA: \`${sourceSha}\`\n- Page routes: ${report.routeTotals.allPageRoutes}\n- Human-facing routes: ${report.routeTotals.humanFacingRoutes}\n- Navigable / contextual / tokenized / compatibility / development / excluded: ${report.routeTotals.navigableRoutes} / ${report.routeTotals.contextualDynamicRoutes} / ${report.routeTotals.tokenizedOrDeepLinkRoutes} / ${report.routeTotals.compatibilityRoutes} / ${report.routeTotals.developmentOnlyRoutes} / ${report.routeTotals.excludedInternalNonPageRoutes}\n- Required / current / stale / missing / blocked / excluded captures: ${report.requiredCaptures} / ${report.currentCaptures} / ${report.staleCaptures} / ${report.missingCaptures} / ${report.blockedByProduct} / ${report.excludedByClassification}\n- Fixture and privacy basis: task-owned combined Homeport and Admiralty synthetic fixtures; private credentials remain outside the repository.\n- Capture browser: recorded per manifest record.\n- Auditor index: \`Experience_Images/index.html\`, \`Experience_Images/auditor-index.json\`, and \`Experience_Images/Contact_Sheets\`.\n\nThe captures are evidence awaiting later Brightwork review. They do not establish product-quality acceptance, deployment, live-provider, or owner acceptance.\n`;
  await writeFile(path.join(brightworkRoot, "Brightwork_Stage_1_Completion_Record.md"), record, "utf8");
  process.stdout.write(`${JSON.stringify({ status, ...summary(report) })}\n`);
}

async function loadCredentials(paths) {
  const [homeport, admiralty] = await Promise.all([json(paths.homeport), json(paths.admiralty)]);
  const homeportAccounts = homeport.accounts ?? homeport.aliases;
  const admiraltyAccounts = admiralty.accounts ?? admiralty.aliases;
  const choose = (source, preferred) => preferred.map((key) => source[key]).find(Boolean);
  return {
    ANONYMOUS: null,
    ORDINARY_PLAYER: choose(homeportAccounts, ["FULL_CAPABILITY", "VERIFIED_FULL_CAPABILITY", "SERA_OWNER"]),
    CAPTAIN_PLAYER: choose(homeportAccounts, ["FULL_CAPABILITY", "RETURNING_FULL_CAPABILITY"]),
    CREATOR: choose(homeportAccounts, ["FULL_CAPABILITY", "RETURNING_FULL_CAPABILITY"]),
    MODERATOR: choose(homeportAccounts, ["MODERATOR", "FULL_CAPABILITY"]),
    ADMIRALTY_OPERATOR: choose(admiraltyAccounts, ["ADMINISTRATOR"]),
    passwords: { homeport: homeport.password, admiralty: admiralty.password },
    admiraltyAccounts,
  };
}

async function storageState(browser, credentials, persona) {
  if (persona === "ANONYMOUS") return undefined;
  const account = credentials[persona];
  if (!account?.email) throw new Error(`BRIGHTWORK_PERSONA_CREDENTIAL_MISSING:${persona}`);
  const password = persona === "ADMIRALTY_OPERATOR" ? credentials.passwords.admiralty : credentials.passwords.homeport;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${required("BRIGHTWORK_BASE_URL").replace(/\/$/u, "")}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email or legacy Player name").fill(account.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForFunction(
      () => fetch("/api/auth/context", { cache: "no-store" }).then((response) => response.json()).then((value) => value.status !== "anonymous" && value.status !== "loading"),
      undefined,
      { timeout: 15_000 },
    );
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function representativeValues(databasePath, credentials) {
  const db = new PrismaClient({ datasources: { db: { url: sqliteUrl(databasePath) } } });
  try {
    const [chronicle, listing, collection, creator, guide, voyageLog, moderation, artifact, history, session] = await Promise.all([
      db.chronicle.findFirst({ where: { status: "PUBLISHED" }, orderBy: { id: "asc" } }),
      db.communityListing.findFirst({ orderBy: { id: "asc" } }),
      db.communityCollection.findFirst({ orderBy: { id: "asc" } }),
      db.communityProfile.findFirst({ orderBy: { id: "asc" } }),
      db.communityGuideContent.findFirst({ orderBy: { id: "asc" } }),
      db.communityVoyageLog.findFirst({ orderBy: { id: "asc" } }),
      db.communityModerationCase.findFirst({ orderBy: { id: "asc" } }),
      db.playerArtifactRecord.findFirst({ orderBy: { id: "asc" } }),
      db.playerChronicleRecord.findFirst({ orderBy: { id: "asc" } }),
      db.taleSession.findFirst({ orderBy: { id: "asc" }, include: { tale: true } }),
    ]);
    const adminTarget = credentials.admiraltyAccounts?.SUPPORT_TARGET ?? credentials.ADMIRALTY_OPERATOR;
    const values = {
      chronicleId: chronicle?.id,
      taleId: chronicle?.id,
      taleSlug: chronicle?.slug,
      campaignSlug: chronicle?.slug,
      listingSlug: listing?.slug,
      listingId: listing?.id,
      collectionSlug: collection?.slug,
      handle: creator?.handle,
      guideSlug: guide?.slug,
      voyageLogSlug: voyageLog?.slug,
      voyageLogId: voyageLog?.id,
      moderationId: moderation?.id,
      artifactId: artifact?.id,
      recordId: history?.id,
      sessionId: session?.id,
      playthroughId: session?.id,
      voyageId: session?.id,
      accountId: adminTarget?.accountId,
      workspace: "dashboard",
    };
    for (const [key, value] of Object.entries(values)) if (!value) throw new Error(`BRIGHTWORK_REPRESENTATIVE_MISSING:${key}`);
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
    "[handle]": values.handle,
    "[workspace]": values.workspace,
  };
  for (const [placeholder, value] of Object.entries(named)) route = route.replaceAll(placeholder, encodeURIComponent(value));
  if (route.includes("[slug]")) {
    const slug = route.includes("collections") ? values.collectionSlug : route.includes("guides") ? values.guideSlug : route.includes("voyage-logs") ? values.voyageLogSlug : values.listingSlug;
    route = route.replaceAll("[slug]", encodeURIComponent(slug));
  }
  if (route.includes("[id]")) route = route.replaceAll("[id]", encodeURIComponent(route.includes("moderation") ? values.moderationId : values.voyageLogId));
  if (/\[[^\]]+\]/u.test(route)) throw new Error(`BRIGHTWORK_UNRESOLVED_DYNAMIC_ROUTE:${pattern}`);
  if (/^\/(reset-password|verify-email|account\/(claim|merge|email-change|reactivate|cancel-deletion)|player\/invitation)/u.test(route))
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
    .map((record) => `<article data-area="${escapeHtml(record.productArea)}" data-theme="${record.theme}" data-viewport="${record.viewport}"><a href="${encodeURI(record.screenshotPath)}"><img loading="lazy" src="${encodeURI(record.screenshotPath)}" alt="${escapeHtml(`${record.routePattern} ${record.state}`)}"></a><h2>${escapeHtml(record.routePattern)}</h2><p>${escapeHtml(`${record.imageId} · ${record.persona} · ${record.theme} · ${record.viewport} · ${record.state}`)}</p></article>`)
    .join("");
  const areas = Object.keys(byArea).sort().map((area) => `<option>${escapeHtml(area)}</option>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Voyagewright Brightwork Experience Images</title><style>body{margin:0;background:#07111b;color:#f6f1e4;font-family:system-ui;padding:24px}header{max-width:1200px;margin:auto}select{margin:6px;padding:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;margin-top:24px}article{background:#132235;border:1px solid #46627d;border-radius:12px;padding:12px}img{width:100%;height:180px;object-fit:contain;background:#05090f}h2{font-size:15px}p{font-size:12px;color:#c6d4df;overflow-wrap:anywhere}.hidden{display:none}</style></head><body><header><h1>Voyagewright Brightwork Experience Images</h1><p>Source <code>${manifest.sourceSha}</code> · ${manifest.records.length} current synthetic captures · pending Brightwork review.</p><label>Area <select id="area"><option>All</option>${areas}</select></label><label>Theme <select id="theme"><option>All</option><option>DARK</option><option>LIGHT</option></select></label><label>Viewport <select id="viewport"><option>All</option><option>desktop</option><option>mobile</option></select></label></header><main>${cards}</main><script>for(const id of ['area','theme','viewport'])document.getElementById(id).addEventListener('change',filter);function filter(){for(const item of document.querySelectorAll('article'))item.classList.toggle('hidden',(area.value!=='All'&&item.dataset.area!==area.value)||(theme.value!=='All'&&item.dataset.theme!==theme.value)||(viewport.value!=='All'&&!item.dataset.viewport.startsWith(viewport.value)))}</script></body></html>`;
  await writeFile(path.join(output, "index.html"), html, "utf8");
}

function indexRecord(record) {
  return { routePattern: record.routePattern, screenId: record.screenId, imageId: record.imageId, screenshotPath: record.screenshotPath, contactSheetDirectory: "Contact_Sheets" };
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
    all.push([`Area_${safeSegment(area)}_Desktop`, routeRecords.filter((record) => record.productArea === area && record.viewport.startsWith("desktop"))]);
  await mkdir(path.join(output, "Contact_Sheets"), { recursive: true });
  for (const [prefix, records] of all) await contactSheets(output, manifest.sourceSha, prefix, records);
}

async function contactSheets(output, sourceSha, prefix, records) {
  const chunks = chunk(records, 24);
  for (let index = 0; index < chunks.length; index += 1) await contactSheet(output, sourceSha, `${prefix}_${String(index + 1).padStart(2, "0")}.png`, chunks[index]);
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
  const composites = [{ input: Buffer.from(`<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#102436"/><text x="16" y="29" font-family="Arial" font-size="16" fill="#f6f1e4">${escapeXml(fileName.replace(/\.png$/u, ""))} · ${sourceSha.slice(0, 12)}</text></svg>`), left: 0, top: 0 }];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const x = gap + (index % columns) * (tileWidth + gap);
    const y = header + gap + Math.floor(index / columns) * (imageHeight + labelHeight + gap);
    const source = path.join(output, ...record.screenshotPath.split("/"));
    const thumbnail = await sharp(source).resize(tileWidth, imageHeight, { fit: "contain", background: "#07111b" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#172b3d"/><text x="8" y="18" font-family="Arial" font-size="11" fill="#f5f1e6">${escapeXml(record.routePattern.slice(0, 52))}</text><text x="8" y="37" font-family="Arial" font-size="10" fill="#bdd2e6">${escapeXml(`${record.imageId} · ${record.persona} · ${record.state}`.slice(0, 60))}</text><text x="8" y="54" font-family="Arial" font-size="10" fill="#e7be6a">${escapeXml(`${record.theme} · ${record.viewport}`)}</text></svg>`);
    composites.push({ input: thumbnail, left: x, top: y }, { input: label, left: x, top: y + imageHeight });
  }
  await sharp({ create: { width, height, channels: 4, background: "#07111b" } }).composite(composites).png().toFile(path.join(output, "Contact_Sheets", fileName));
}

async function writeLimitations(report) {
  const rows = report.blocked.map((record) => `- \`${record.routePattern}\` ${record.viewport} ${record.theme}: ${record.limitation}`).join("\n") || "- None recorded.";
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
    excludedByClassification: report.excludedByClassification,
    completeness: report.overallCompleteness,
  };
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
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function isNonEmpty(file) {
  try {
    return (await stat(file)).size > 100;
  } catch {
    return false;
  }
}

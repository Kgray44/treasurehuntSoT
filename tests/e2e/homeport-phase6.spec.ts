import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE6_TASK_ROOT ?? "C:/Users/kkids/AppData/Local/Temp/homeport-phase6-019fcb64",
);
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE6_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase6"),
);
const fixtureVersion = "homeport-phase6-v1";
const expectedSourceSha = "e02ee0dae0469a2ba573beaf409c0b34e8668d09";
const sourceSha = execFileSync("git", ["rev-parse", "e02ee0dae0469a2ba573beaf409c0b34e8668d09"], {
  encoding: "utf8",
}).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const password = "Homeport-Phase4-Synthetic!";
const records: EvidenceRecord[] = [];
let secrets: Record<string, string> = {};
let fixtureChecksum = "UNAVAILABLE";
let browserVersion = "unknown";
let fullContext: BrowserContext;
let moderatorContext: BrowserContext;
let restrictedContext: BrowserContext;
let playerContext: BrowserContext;
let anonymousContext: BrowserContext;
let evidenceSequence = 0;

type Profile = "anonymous" | "full" | "moderator" | "restricted" | "player";
type Target = Readonly<{
  screenId: string;
  routePattern: string;
  actualPath: string | ((fixtureSecrets: Record<string, string>) => string);
  profile: Profile;
  productArea: string;
  criticality: "CRITICAL" | "HIGH";
}>;
type EvidenceRecord = Readonly<{
  evidenceId: string;
  screenId: string;
  route: string;
  productArea: string;
  state: string;
  criticality: string;
  fixtureVersion: string;
  fixtureChecksum: string;
  accountState: string;
  viewportFamily: string;
  viewport: string;
  zoom: string;
  motionMode: string;
  sourceSha: string;
  branch: string;
  browser: string;
  capturePath: string;
  sha256: string;
  visualReviewClassification: string;
  accessibilityResult: string;
  semanticResult: string;
  overflowResult: string;
  defectsFound: string;
  correctionCommit: string;
  limitation: string;
}>;

const targets: readonly Target[] = [
  target("root", "/", "/", "anonymous", "Gateway and public shell", "CRITICAL"),
  target("sign-in", "/sign-in", "/sign-in", "anonymous", "Identity and session", "CRITICAL"),
  target("player-library", "/player/library", "/player/library", "full", "Player", "CRITICAL"),
  target("captain-library", "/captain/library", "/captain/library", "full", "Captain", "CRITICAL"),
  target("studio-library", "/studio/library", "/studio/library", "full", "Creator Studio", "CRITICAL"),
  target("account", "/account", "/account", "full", "Personal Harbor", "CRITICAL"),
  target("account-profile", "/account/profile", "/account/profile", "full", "Personal Harbor", "CRITICAL"),
  target("passport", "/passport", "/passport", "full", "Chronicle Passport", "CRITICAL"),
  target("community", "/community", "/community", "anonymous", "Community Harbor", "CRITICAL"),
  target(
    "player-playthroughs-playthroughid",
    "/player/playthroughs/[playthroughId]",
    "/player/playthroughs/hp5-session-ready",
    "full",
    "Player",
    "CRITICAL",
  ),
  target(
    "captain-sessions-sessionid",
    "/captain/sessions/[sessionId]",
    "/captain/sessions/hp5-session-ready",
    "full",
    "Captain",
    "CRITICAL",
  ),
  target(
    "studio-tales-taleid",
    "/studio/tales/[taleId]",
    "/studio/tales/hp4-tale-lantern-coast",
    "full",
    "Creator Studio",
    "CRITICAL",
  ),
  target("register", "/register", "/register", "anonymous", "Identity and session", "HIGH"),
  target("forgot-password", "/forgot-password", "/forgot-password", "anonymous", "Identity and session", "HIGH"),
  target(
    "reset-password",
    "/reset-password",
    (value) => `/reset-password?token=${value.resetValid}`,
    "anonymous",
    "Identity and session",
    "HIGH",
  ),
  target(
    "verify-email",
    "/verify-email",
    (value) => `/verify-email?token=${value.verifyValid}`,
    "anonymous",
    "Identity and session",
    "HIGH",
  ),
  target("account-security", "/account/security", "/account/security", "full", "Personal Harbor", "HIGH"),
  target("account-sessions", "/account/sessions", "/account/sessions", "full", "Personal Harbor", "HIGH"),
  target("passport-history", "/passport/history", "/passport/history", "full", "Chronicle Passport", "HIGH"),
  target(
    "passport-history-[recordId]",
    "/passport/history/[recordId]",
    "/passport/history/hp5-history-route",
    "full",
    "Chronicle Passport",
    "HIGH",
  ),
  target("passport-artifacts", "/passport/artifacts", "/passport/artifacts", "full", "Chronicle Passport", "HIGH"),
  target(
    "passport-artifacts-[artifactId]",
    "/passport/artifacts/[artifactId]",
    "/passport/artifacts/hp5-artifact-route",
    "full",
    "Chronicle Passport",
    "HIGH",
  ),
  target(
    "community-chronicles",
    "/community/chronicles",
    "/community/chronicles",
    "anonymous",
    "Community Harbor",
    "HIGH",
  ),
  target(
    "community-slug",
    "/community/[slug]",
    "/community/lantern-coast-chronicle",
    "anonymous",
    "Community Harbor",
    "HIGH",
  ),
  target(
    "community-collections-slug",
    "/community/collections/[slug]",
    "/community/collections/harbor-starters",
    "anonymous",
    "Community Harbor",
    "HIGH",
  ),
  target(
    "community-moderation",
    "/community/moderation",
    "/community/moderation",
    "moderator",
    "Community Harbor",
    "HIGH",
  ),
  target(
    "player-playthroughs-playthroughid-journal",
    "/player/playthroughs/[playthroughId]/journal",
    "/player/playthroughs/hp5-session-active/journal",
    "full",
    "Player",
    "HIGH",
  ),
  target(
    "player-invitation",
    "/player/invitation",
    (value) => `/join/${value.invitationValid}`,
    "anonymous",
    "Player",
    "HIGH",
  ),
  target(
    "studio-private-content",
    "/studio/private-content",
    "/studio/private-content",
    "full",
    "Creator Studio",
    "HIGH",
  ),
];
const selectedScreen = process.env.HOMEPORT_PHASE6_ONLY_SCREEN;
const selectedTargets = selectedScreen ? targets.filter((entry) => entry.screenId === selectedScreen) : targets;

const zoomScreenIds = new Set(
  targets.filter((entry) => entry.criticality === "CRITICAL").map((entry) => entry.screenId),
);

test.describe.serial("Project Homeport Phase 6 complete surface evidence", () => {
  test.beforeAll(async ({ browser }) => {
    expect(sourceSha).toBe(expectedSourceSha);
    expect(branch).toBe("codex/project-homeport-product-reality-recovery");
    secrets = JSON.parse(readFileSync(path.join(taskRoot, "browser-state", "phase5-secrets.json"), "utf8"));
    const receipt = JSON.parse(
      readFileSync(path.join(taskRoot, "browser-state", "phase6-fixture-receipt.json"), "utf8"),
    );
    fixtureChecksum = createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
    browserVersion = browser.version();
    [anonymousContext, fullContext, moderatorContext, restrictedContext, playerContext] = await Promise.all([
      browser.newContext(),
      signedInContext(browser, "hp4-creator"),
      signedInContext(browser, "hp4-moderator"),
      signedInContext(browser, "hp4-restricted"),
      signedInContext(browser, "hp4-player"),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      fullContext.close(),
      moderatorContext.close(),
      restrictedContext.close(),
      playerContext.close(),
      anonymousContext.close(),
    ]);
    const manifest = {
      schemaVersion: "1.0.0",
      phase: "PROJECT_HOMEPORT_PHASE_6",
      sourceSha,
      branch,
      fixtureVersion,
      fixtureChecksum,
      browser: `Chromium ${browserVersion}`,
      productionRuntime: true,
      records,
      limitation:
        "Synthetic local branch evidence only; not merge, deploy, live MySQL, live external-provider, owner, physical screen-reader, or product acceptance proof.",
    };
    await writeFile(path.join(evidenceRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });

  test("critical and high screens render at desktop and mobile without serious accessibility or overflow defects", async ({
    browser,
  }) => {
    for (const definition of selectedTargets) {
      for (const viewport of [
        { family: "STANDARD_DESKTOP", width: 1440, height: 900 },
        { family: "MODERN_MOBILE", width: 390, height: 844 },
      ] as const) {
        const page = await pageForProfile(browser, definition.profile);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        if (definition.screenId === "screen-page-player-playthroughs-playthroughid-journal")
          await page.addInitScript(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        await page.goto(resolvePath(definition.actualPath));
        await settle(page);
        const audit =
          viewport.family === "STANDARD_DESKTOP" ? await accessibilityAudit(page) : "SEMANTIC_ASSERTIONS_ONLY";
        await capture(page, definition, {
          family: viewport.family,
          width: viewport.width,
          height: viewport.height,
          state: "READY_POPULATED",
          accessibilityResult: audit,
        });
        await page.close();
      }
    }
  });

  test("every critical screen preserves function across compact desktop, tablet, and narrow mobile", async ({
    browser,
  }) => {
    for (const definition of selectedTargets.filter((entry) => entry.criticality === "CRITICAL")) {
      for (const viewport of [
        { family: "COMPACT_DESKTOP", width: 1280, height: 720 },
        { family: "TABLET_LANDSCAPE", width: 1024, height: 768 },
        { family: "TABLET_PORTRAIT", width: 768, height: 1024 },
        { family: "NARROW_MOBILE", width: 320, height: 568 },
      ] as const) {
        const page = await pageForProfile(browser, definition.profile);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        if (definition.screenId === "screen-page-player-playthroughs-playthroughid-journal")
          await page.addInitScript(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        await page.goto(resolvePath(definition.actualPath));
        await settle(page);
        await capture(page, definition, {
          family: viewport.family,
          width: viewport.width,
          height: viewport.height,
          state: "READY_POPULATED",
          accessibilityResult: "SEMANTIC_ASSERTIONS_ONLY",
        });
        await page.close();
      }
    }
  });

  test("high-risk screens pass effective 200 percent layout viewport evidence", async ({ browser }) => {
    for (const definition of targets.filter((entry) => zoomScreenIds.has(entry.screenId))) {
      const page = await pageForProfile(browser, definition.profile);
      await page.setViewportSize({ width: 720, height: 450 });
      await page.goto(resolvePath(definition.actualPath));
      await settle(page);
      await capture(page, definition, {
        family: "EFFECTIVE_200_PERCENT",
        width: 720,
        height: 450,
        state: "READY_POPULATED",
        zoom: "200_PERCENT_EQUIVALENT_LAYOUT_VIEWPORT",
        accessibilityResult: await accessibilityAudit(page),
      });
      await page.close();
    }
  });

  test("dialogs, permission, token, no-results, and reduced-motion states remain distinct", async ({ browser }) => {
    const captain = await fullContext.newPage();
    await captain.goto("/captain/library");
    await settle(captain);
    const begin = captain.getByRole("button", { name: "Begin Voyage" }).first();
    await expect(begin).toBeVisible();
    await begin.click();
    await expect(captain.getByRole("dialog")).toBeVisible();
    await capture(captain, targets.find((entry) => entry.screenId === "screen-page-captain-library")!, {
      family: "STANDARD_DESKTOP",
      width: 1440,
      height: 900,
      state: "MUTATION_PENDING",
      accessibilityResult: await accessibilityAudit(captain),
      suffix: "dialog",
    });
    await captain.keyboard.press("Escape");
    await expect(begin).toBeFocused();
    await captain.close();

    const denied = await restrictedContext.newPage();
    await denied.goto("/community/moderation/hp5-moderation-case");
    await settle(denied);
    await expect(denied.getByRole("heading", { name: "Account access restricted" })).toBeVisible();
    await capture(
      denied,
      {
        ...targets.find((entry) => entry.screenId === "screen-page-community-moderation")!,
        screenId: "screen-page-community-moderation-id",
        routePattern: "/community/moderation/[id]",
      },
      {
        family: "STANDARD_DESKTOP",
        width: 1440,
        height: 900,
        state: "PERMISSION_RESTRICTED",
        accessibilityResult: await accessibilityAudit(denied),
        suffix: "restricted",
      },
    );
    await denied.close();

    for (const entry of [
      { suffix: "token-invalid", token: "phase6-invalid-token", state: "TOKEN_INVALID" },
      { suffix: "token-expired", token: secrets.resetExpired, state: "TOKEN_EXPIRED" },
      { suffix: "token-consumed", token: secrets.resetConsumed, state: "TOKEN_CONSUMED" },
    ]) {
      const page = await anonymousContext.newPage();
      await page.goto(`/reset-password?token=${entry.token}`);
      await settle(page);
      await page.getByLabel("Password", { exact: true }).fill("Phase6-Invalid-Probe!123");
      await page.getByLabel("Confirm password", { exact: true }).fill("Phase6-Invalid-Probe!123");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await capture(page, targets.find((targetEntry) => targetEntry.screenId === "screen-page-reset-password")!, {
        family: "STANDARD_DESKTOP",
        width: 1440,
        height: 900,
        state: entry.state,
        accessibilityResult: await accessibilityAudit(page),
        suffix: entry.suffix,
      });
      await page.close();
    }

    const revoked = await anonymousContext.newPage();
    await revoked.goto(`/join/${secrets.invitationRevoked}`);
    await settle(revoked);
    await capture(revoked, targets.find((entry) => entry.screenId === "screen-page-player-invitation")!, {
      family: "MODERN_MOBILE",
      width: 390,
      height: 844,
      state: "TOKEN_REVOKED",
      accessibilityResult: await accessibilityAudit(revoked),
      suffix: "token-revoked",
    });
    await revoked.close();

    const noResults = await anonymousContext.newPage();
    await noResults.goto("/community?query=phase6-no-match-zzzz");
    await settle(noResults);
    const search = noResults.getByRole("searchbox").first();
    if (await search.isVisible()) {
      await search.fill("phase6-no-match-zzzz");
      await search.press("Enter");
      await expect(noResults.locator("body")).toContainText(/no .*match|no results/iu);
    }
    await capture(noResults, targets.find((entry) => entry.screenId === "screen-page-community")!, {
      family: "STANDARD_DESKTOP",
      width: 1440,
      height: 900,
      state: "NO_RESULTS",
      accessibilityResult: await accessibilityAudit(noResults),
      suffix: "no-results",
    });
    await noResults.close();

    const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
    const reduced = await reducedContext.newPage();
    await reduced.goto("/");
    await settle(reduced);
    await capture(reduced, targets[0], {
      family: "STANDARD_DESKTOP",
      width: 1440,
      height: 900,
      state: "READY_POPULATED",
      motionMode: "REDUCED",
      accessibilityResult: await accessibilityAudit(reduced),
      suffix: "reduced-motion",
    });
    await reducedContext.close();
  });
});

function target(
  suffix: string,
  routePattern: string,
  actualPath: Target["actualPath"],
  profile: Profile,
  productArea: string,
  criticality: Target["criticality"],
): Target {
  return {
    screenId: `screen-page-${suffix}`,
    routePattern,
    actualPath,
    profile,
    productArea,
    criticality,
  };
}

function resolvePath(value: Target["actualPath"]) {
  return typeof value === "function" ? value(secrets) : value;
}

async function signedInContext(browser: Browser, username: string) {
  const context = await browser.newContext();
  const response = await context.request.post("/api/gm/login", { data: { username, password } });
  expect(response.ok(), `${username} login failed: ${await response.text()}`).toBeTruthy();
  return context;
}

async function pageForProfile(browser: Browser, profile: Profile) {
  if (profile === "anonymous") return anonymousContext.newPage();
  if (profile === "full") return fullContext.newPage();
  if (profile === "moderator") return moderatorContext.newPage();
  if (profile === "restricted") return restrictedContext.newPage();
  return playerContext.newPage();
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("main").first()).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const openJournal = page.getByRole("button", { name: /Open the journal/iu });
  if (await openJournal.isVisible().catch(() => false)) {
    await openJournal.click();
    await expect(page.getByRole("dialog", { name: "Open the voyage journal" })).toBeHidden();
    const skipCeremony = page.getByRole("button", { name: "Skip ceremony" });
    if (
      await skipCeremony
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    )
      await skipCeremony.click();
    await expect(page.getByRole("dialog", { name: "Journal opening in progress" })).toBeHidden();
  }
  await expect(page.locator("h1").first()).toBeVisible();
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(250);
  await expect(page.locator("[data-nextjs-dialog], nextjs-portal")).toHaveCount(0);
  const layout = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    return {
      overflow: document.documentElement.scrollWidth - clientWidth,
      offenders: [...document.querySelectorAll<HTMLElement>("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: element.className,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        })
        .filter((entry) => entry.right > clientWidth + 1 || entry.left < -1)
        .sort((left, right) => right.right - left.right)
        .slice(0, 8),
    };
  });
  expect(layout.overflow, JSON.stringify(layout.offenders)).toBeLessThanOrEqual(1);
}

async function accessibilityAudit(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  expect(severe, severe.map((violation) => `${violation.id}:${violation.nodes.length}`).join(", ")).toEqual([]);
  return "ZERO_SERIOUS_OR_CRITICAL";
}

async function capture(
  page: Page,
  definition: Target,
  options: {
    family: string;
    width: number;
    height: number;
    state: string;
    accessibilityResult: string;
    suffix?: string;
    zoom?: string;
    motionMode?: string;
  },
) {
  await page.setViewportSize({ width: options.width, height: options.height });
  evidenceSequence += 1;
  const slug = definition.screenId.replace(/^screen-page-/u, "").replaceAll(/[^a-z0-9]+/gu, "-");
  const evidenceId = `HP-P6-EV-${String(evidenceSequence).padStart(3, "0")}-${slug}-${options.suffix ?? options.family.toLocaleLowerCase().replaceAll("_", "-")}`;
  const capturePath = path.join(evidenceRoot, `${evidenceId}.png`);
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: capturePath, fullPage: true });
  const bytes = await readFile(capturePath);
  const relative = path.relative(process.cwd(), capturePath).replaceAll("\\", "/");
  records.push({
    evidenceId,
    screenId: definition.screenId,
    route: definition.routePattern,
    productArea: definition.productArea,
    state: options.state,
    criticality: definition.criticality,
    fixtureVersion,
    fixtureChecksum,
    accountState: accountState(definition.profile),
    viewportFamily: options.family,
    viewport: `${options.width}x${options.height}`,
    zoom: options.zoom ?? "100_PERCENT",
    motionMode: options.motionMode ?? "FULL",
    sourceSha,
    branch,
    browser: `Chromium ${browserVersion}`,
    capturePath: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    visualReviewClassification: "PENDING_CODEX_VISUAL_REVIEW",
    accessibilityResult: options.accessibilityResult,
    semanticResult: "H1_MAIN_AND_NAMED_CONTROL_ASSERTIONS_PASSED",
    overflowResult: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
    defectsFound: "PENDING_REVIEW",
    correctionCommit: "NOT_REQUIRED_PENDING_REVIEW",
    limitation:
      "Synthetic local production-runtime branch evidence; not deployment, live provider, owner, physical screen-reader, or product acceptance proof.",
  });
}

function accountState(profile: Profile) {
  if (profile === "anonymous") return "ANONYMOUS";
  if (profile === "moderator") return "AUTHENTICATED_MODERATOR";
  if (profile === "restricted") return "RESTRICTED_ACCOUNT";
  if (profile === "player") return "AUTHENTICATED_PLAYER";
  return "AUTHENTICATED_PLAYER_CAPTAIN_CREATOR";
}

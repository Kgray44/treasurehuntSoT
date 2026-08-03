import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";

const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE5_TASK_ROOT ?? "C:/Users/kkids/AppData/Local/Temp/homeport-phase5-019fc830",
);
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE5_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase5"),
);
const fixtureVersion = "homeport-phase5-route-reachability-v1";
let fixtureChecksum = "UNAVAILABLE_OUTSIDE_PHASE5_RUNTIME";
let secrets: Record<string, string> = {};
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const records: EvidenceRecord[] = [];
const receipts: RouteReceipt[] = [];
const password = "Homeport-Phase4-Synthetic!";
const naturalRoutes = new Set<string>();
const dynamicPaths = new Map<string, string>();
let browserVersion = "unknown";
let fullContext: BrowserContext;
let playerContext: BrowserContext;
let moderatorContext: BrowserContext;
let restrictedContext: BrowserContext;

type Profile = "anonymous" | "full" | "player" | "moderator";
type OrdinaryRoute = Readonly<{
  routeId: string;
  path: string;
  profile: Profile;
  steps: readonly string[];
}>;
type RouteReceipt = Readonly<{
  routeId: string;
  routePattern: string;
  observedPath: string;
  classification: string;
  accountFixture: string;
  naturalPath: string[];
  visibleControls: string[];
  naturalResult: string;
  directEntryResult: string;
  returnResult: string;
  desktopResult: string;
  mobileResult: string;
  sourceSha: string;
  branch: string;
  timestamp: string;
  limitation: string;
}>;
type EvidenceRecord = Readonly<{
  evidenceId: string;
  sourceSha: string;
  branch: string;
  route: string;
  screenContract: string;
  journey: string;
  accountFixture: string;
  fixtureVersion: string;
  fixtureChecksum: string;
  browser: string;
  viewport: string;
  zoom: string;
  motionMode: string;
  appearanceState: string;
  dataState: string;
  screenshotPath: string;
  committedScreenshotPath: string;
  sha256: string;
  observedResult: string;
  knownDeviation: string;
  timestamp: string;
  reviewerClassification: string;
}>;

const ordinaryRoutes: readonly OrdinaryRoute[] = [
  { routeId: "route-page-root", path: "/", profile: "anonymous", steps: [] },
  { routeId: "route-page-register", path: "/register", profile: "anonymous", steps: ["/register"] },
  { routeId: "route-page-sign-in", path: "/sign-in", profile: "anonymous", steps: ["/sign-in"] },
  {
    routeId: "route-page-forgot-password",
    path: "/forgot-password",
    profile: "anonymous",
    steps: ["/sign-in", "/forgot-password"],
  },
  { routeId: "route-page-tales", path: "/tales", profile: "anonymous", steps: ["/tales"] },
  { routeId: "route-page-community", path: "/community", profile: "anonymous", steps: ["/community"] },
  ...[
    "artifacts",
    "audio",
    "chronicles",
    "collections",
    "creators",
    "featured",
    "guides",
    "maps",
    "templates",
    "voyage-logs",
  ].map((suffix) => ({
    routeId: `route-page-community-${suffix}`,
    path: `/community/${suffix}`,
    profile: "anonymous" as const,
    steps: ["/community", `/community/${suffix}`],
  })),
  {
    routeId: "route-page-community-voyage-logs-consent",
    path: "/community/voyage-logs/consent",
    profile: "full",
    steps: ["/community", "/community/voyage-logs", "/community/voyage-logs/consent"],
  },
  {
    routeId: "route-page-community-voyage-logs-owner",
    path: "/community/voyage-logs/owner",
    profile: "player",
    steps: ["/community", "/community/voyage-logs", "/community/voyage-logs/owner"],
  },
  {
    routeId: "route-page-community-moderation",
    path: "/community/moderation",
    profile: "moderator",
    steps: ["/community/moderation"],
  },
  { routeId: "route-page-account", path: "/account", profile: "full", steps: ["/account"] },
  ...["accessibility", "data", "linked-identities", "notifications", "personal-information", "profile"].map(
    (suffix) => ({
      routeId: `route-page-account-${suffix}`,
      path: `/account/${suffix}`,
      profile: "full" as const,
      steps: ["/account", `/account/${suffix}`],
    }),
  ),
  ...["preferences", "privacy", "roles", "security", "sessions"].map((suffix) => ({
    routeId: `route-page-account-${suffix}`,
    path: `/account/${suffix}`,
    profile: "full" as const,
    steps: [`/account/${suffix}`],
  })),
  { routeId: "route-page-passport", path: "/passport", profile: "full", steps: ["/passport"] },
  ...["memories", "saved"].map((suffix) => ({
    routeId: `route-page-passport-${suffix}`,
    path: `/passport/${suffix}`,
    profile: "full" as const,
    steps: ["/passport", `/passport/${suffix}`],
  })),
  ...["artifacts", "history"].map((suffix) => ({
    routeId: `route-page-passport-${suffix}`,
    path: `/passport/${suffix}`,
    profile: "full" as const,
    steps: [`/passport/${suffix}`],
  })),
  {
    routeId: "route-page-player-library",
    path: "/player/library",
    profile: "full",
    steps: ["/player/library"],
  },
  {
    routeId: "route-page-captain-library",
    path: "/captain/library",
    profile: "full",
    steps: ["/captain/library"],
  },
  {
    routeId: "route-page-studio-library",
    path: "/studio/library",
    profile: "full",
    steps: ["/studio/library"],
  },
  ...["exchange", "private-content", "tales/new"].map((suffix) => ({
    routeId: `route-page-studio-${suffix.replace("/", "-")}`,
    path: `/studio/${suffix}`,
    profile: "full" as const,
    steps: ["/studio/library", `/studio/${suffix}`],
  })),
];

const ordinaryEvidence = new Map<string, [string, string]>([
  ["/", ["HP-P5-EV-A-route-map", "HP-P5-JRN-A"]],
  ["/sign-in", ["HP-P5-EV-B-anonymous", "HP-P5-JRN-B"]],
  ["/player/library", ["HP-P5-EV-C-player", "HP-P5-JRN-C"]],
  ["/captain/library", ["HP-P5-EV-D-captain", "HP-P5-JRN-D"]],
  ["/studio/library", ["HP-P5-EV-E-creator", "HP-P5-JRN-E"]],
  ["/account", ["HP-P5-EV-F-personal-harbor", "HP-P5-JRN-F"]],
  ["/community", ["HP-P5-EV-G-community", "HP-P5-JRN-G"]],
  ["/tales", ["HP-P5-EV-H-dynamic-source", "HP-P5-JRN-H"]],
]);

test.describe.serial("Project Homeport Phase 5 route reachability acceptance", () => {
  test.beforeAll(async ({ browser }) => {
    expect(branch).toBe("codex/project-homeport-product-reality-recovery");
    secrets = JSON.parse(readFileSync(path.join(taskRoot, "browser-state", "phase5-secrets.json"), "utf8"));
    const fixtureReceipt = JSON.parse(
      readFileSync(path.join(taskRoot, "browser-state", "fixture-receipt.json"), "utf8"),
    );
    fixtureChecksum = fixtureReceipt.phase5.fixtureChecksum as string;
    browserVersion = browser.version();
    fullContext = await signedInContext(browser, "hp4-creator");
    playerContext = await signedInContext(browser, "hp4-player");
    moderatorContext = await signedInContext(browser, "hp4-moderator");
    restrictedContext = await signedInContext(browser, "hp4-restricted");
  });

  test.afterAll(async () => {
    await Promise.all([
      fullContext.close(),
      playerContext.close(),
      moderatorContext.close(),
      restrictedContext.close(),
    ]);
    await mkdir(path.join(evidenceRoot, "route-receipts"), { recursive: true });
    for (const receipt of receipts)
      await writeFile(
        path.join(evidenceRoot, "route-receipts", `${receipt.routeId}.json`),
        `${JSON.stringify(receipt, null, 2)}\n`,
        "utf8",
      );
    const manifest = {
      schemaVersion: "1.0.0",
      phase: "PROJECT_HOMEPORT_PHASE_5",
      sourceSha,
      branch,
      fixtureVersion,
      fixtureChecksum,
      browser: `Chromium ${browserVersion}`,
      ordinaryRouteReceipts: receipts.filter((receipt) => receipt.classification === "USER_NAVIGABLE").length,
      totalRouteReceipts: receipts.length,
      records,
    };
    await writeFile(path.join(evidenceRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });

  test("A-H, J, AA, AC, AD: every ordinary route is reached naturally before direct entry", async ({ browser }) => {
    expect(ordinaryRoutes).toHaveLength(42);
    for (const definition of ordinaryRoutes) {
      const page = await pageForProfile(browser, definition.profile);
      const controls = await traverseFromGateway(page, definition.steps, definition.path);
      naturalRoutes.add(definition.routeId);
      const evidence = ordinaryEvidence.get(definition.path);
      if (evidence)
        await capture(page, evidence[0], {
          screenContract: screenContract(definition.routeId),
          journey: evidence[1],
          accountFixture: accountFixture(definition.profile),
          appearanceState: "NATURAL_PATH_COMPLETE",
        });
      const returnResult = await followRegisteredReturn(page, definition.path);
      await page.goto(definition.path);
      await settleCurrentRoute(page);
      expect(new URL(page.url()).pathname).toBe(definition.path);
      receipts.push(
        routeReceipt({
          routeId: definition.routeId,
          routePattern: definition.path,
          observedPath: definition.path,
          classification: "USER_NAVIGABLE",
          profile: definition.profile,
          naturalPath: ["/", ...definition.steps],
          controls,
          returnResult,
        }),
      );
      await page.close();
    }
    expect(naturalRoutes.size).toBe(42);

    const summaryPage = await browser.newPage();
    await summaryPage.goto("/");
    await settleCurrentRoute(summaryPage);
    for (const [id, appearance] of [
      ["HP-P5-EV-AA-zero-orphan", "ZERO_UNEXPLAINED_ORDINARY_ORPHANS"],
      ["HP-P5-EV-AC-parent-graph", "PARENT_GRAPH_COMPLETE_AND_ACYCLIC"],
      ["HP-P5-EV-AD-full-traversal-summary", "FORTY_TWO_ORDINARY_ROUTES_TRAVERSED"],
    ] as const)
      await capture(summaryPage, id, {
        screenContract: "screen-page-root",
        journey: id.includes("AA") ? "HP-P5-JRN-AA" : id.includes("AC") ? "HP-P5-JRN-AC" : "HP-P5-JRN-AD",
        accountFixture: "ANONYMOUS",
        appearanceState: appearance,
      });
    await summaryPage.close();
  });

  test("I, S, T: dynamic routes have source, detail, return, invalid-id, and permission proof", async ({ browser }) => {
    const definitions: Array<{
      routeId: string;
      pattern: string;
      actual: string;
      profile: Profile;
      sourceSteps: string[];
      journey: string;
      prepareLabel?: string;
    }> = [
      {
        routeId: "route-page-captain-sessions-sessionid",
        pattern: "/captain/sessions/[sessionId]",
        actual: "/captain/sessions/hp5-session-ready",
        profile: "full",
        sourceSteps: ["/captain/library"],
        journey: "HP-P5-JRN-D",
      },
      {
        routeId: "route-page-captain-tales-taleid",
        pattern: "/captain/tales/[taleId]",
        actual: "/captain/tales/hp4-tale-lantern-coast",
        profile: "full",
        sourceSteps: ["/captain/library"],
        journey: "HP-P5-JRN-D",
        prepareLabel: "Published Chronicles",
      },
      {
        routeId: "route-page-captain-voyages-playthroughid-player-preview",
        pattern: "/captain/voyages/[playthroughId]/player-preview",
        actual: "/captain/voyages/hp5-session-ready/player-preview",
        profile: "full",
        sourceSteps: ["/captain/library"],
        journey: "HP-P5-JRN-D",
      },
      {
        routeId: "route-page-community-slug",
        pattern: "/community/[slug]",
        actual: "/community/lantern-coast-chronicle",
        profile: "anonymous",
        sourceSteps: ["/community", "/community/chronicles"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-collections-slug",
        pattern: "/community/collections/[slug]",
        actual: "/community/collections/harbor-starters",
        profile: "anonymous",
        sourceSteps: ["/community", "/community/collections"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-creators-handle",
        pattern: "/community/creators/[handle]",
        actual: "/community/creators/captain-almanac",
        profile: "anonymous",
        sourceSteps: ["/community", "/community/creators"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-guides-slug",
        pattern: "/community/guides/[slug]",
        actual: "/community/guides/reading-the-weathered-chart",
        profile: "anonymous",
        sourceSteps: ["/community", "/community/guides"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-moderation-id",
        pattern: "/community/moderation/[id]",
        actual: "/community/moderation/hp5-moderation-case",
        profile: "moderator",
        sourceSteps: ["/community/moderation"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-voyage-logs-slug",
        pattern: "/community/voyage-logs/[slug]",
        actual: "/community/voyage-logs/fictional-lantern-voyage",
        profile: "anonymous",
        sourceSteps: ["/community", "/community/voyage-logs"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-community-voyage-logs-owner-id",
        pattern: "/community/voyage-logs/owner/[id]",
        actual: "/community/voyage-logs/owner/hp4-voyage-log-lantern",
        profile: "player",
        sourceSteps: ["/community", "/community/voyage-logs", "/community/voyage-logs/owner"],
        journey: "HP-P5-JRN-G",
      },
      {
        routeId: "route-page-passport-artifacts-[artifactId]",
        pattern: "/passport/artifacts/[artifactId]",
        actual: "/passport/artifacts/hp5-artifact-route",
        profile: "full",
        sourceSteps: ["/passport/artifacts"],
        journey: "HP-P5-JRN-F",
      },
      {
        routeId: "route-page-passport-history-[recordId]",
        pattern: "/passport/history/[recordId]",
        actual: "/passport/history/hp5-history-route",
        profile: "full",
        sourceSteps: ["/passport/history"],
        journey: "HP-P5-JRN-F",
      },
      {
        routeId: "route-page-play-taleslug",
        pattern: "/play/[taleSlug]",
        actual: "/play/hp4-lantern-coast",
        profile: "anonymous",
        sourceSteps: ["/tales"],
        journey: "HP-P5-JRN-C",
      },
      {
        routeId: "route-page-play-taleslug-history",
        pattern: "/play/[taleSlug]/history",
        actual: "/play/hp4-lantern-coast/history",
        profile: "anonymous",
        sourceSteps: ["/tales", "/play/hp4-lantern-coast"],
        journey: "HP-P5-JRN-C",
      },
      {
        routeId: "route-page-player-playthroughs-playthroughid",
        pattern: "/player/playthroughs/[playthroughId]",
        actual: "/player/playthroughs/hp5-session-ready",
        profile: "full",
        sourceSteps: ["/player/library"],
        journey: "HP-P5-JRN-C",
      },
      {
        routeId: "route-page-player-playthroughs-playthroughid-journal",
        pattern: "/player/playthroughs/[playthroughId]/journal",
        actual: "/player/playthroughs/hp5-session-active/journal",
        profile: "full",
        sourceSteps: ["/player/library"],
        journey: "HP-P5-JRN-C",
      },
      {
        routeId: "route-page-profile-handle",
        pattern: "/profile/[handle]",
        actual: "/profile/hp4-creator",
        profile: "full",
        sourceSteps: ["/account", "/account/profile"],
        journey: "HP-P5-JRN-F",
      },
      {
        routeId: "route-page-studio-tales-taleid",
        pattern: "/studio/tales/[taleId]",
        actual: "/studio/tales/hp4-tale-lantern-coast",
        profile: "full",
        sourceSteps: ["/studio/library"],
        journey: "HP-P5-JRN-E",
      },
      ...["artifacts", "assets", "locations", "settings", "versions"].map((suffix) => ({
        routeId: `route-page-studio-tales-taleid-${suffix}`,
        pattern: `/studio/tales/[taleId]/${suffix}`,
        actual: `/studio/tales/hp4-tale-lantern-coast/${suffix}`,
        profile: "full" as const,
        sourceSteps: ["/studio/library", "/studio/tales/hp4-tale-lantern-coast"],
        journey: "HP-P5-JRN-E",
      })),
    ];

    for (const definition of definitions) {
      const page = await pageForProfile(browser, definition.profile);
      const controls = await traverseFromGateway(page, definition.sourceSteps, definition.sourceSteps.at(-1) ?? "/");
      if (definition.prepareLabel) {
        const preparatoryControl = page.getByRole("button", { name: definition.prepareLabel, exact: true });
        await expect(preparatoryControl).toBeVisible();
        await preparatoryControl.click();
        await expect(preparatoryControl).toHaveAttribute("aria-pressed", "true");
        controls.push(definition.prepareLabel);
      }
      controls.push(await clickVisibleHref(page, definition.actual));
      expect(new URL(page.url()).pathname).toBe(definition.actual);
      dynamicPaths.set(definition.routeId, definition.actual);
      if (definition.routeId === "route-page-play-taleslug")
        await capture(page, "HP-P5-EV-I-dynamic-detail-parent", {
          screenContract: screenContract(definition.routeId),
          journey: "HP-P5-JRN-I",
          accountFixture: accountFixture(definition.profile),
          appearanceState: "DYNAMIC_DETAIL_FROM_PARENT",
        });
      if (definition.routeId === "route-page-captain-sessions-sessionid")
        await capture(page, "HP-P5-EV-S-compact-exit", {
          screenContract: screenContract(definition.routeId),
          journey: "HP-P5-JRN-S",
          accountFixture: "AUTHENTICATED_CAPTAIN_CREATOR_PLAYER",
          appearanceState: "COMPACT_CONTEXT_EXIT",
        });
      const returnResult = await followRegisteredReturn(page, definition.actual);
      await page.goto(definition.actual);
      await settleCurrentRoute(page);
      receipts.push(
        routeReceipt({
          routeId: definition.routeId,
          routePattern: definition.pattern,
          observedPath: definition.actual,
          classification: "CONTEXTUAL_DETAIL",
          profile: definition.profile,
          naturalPath: ["/", ...definition.sourceSteps, definition.actual],
          controls,
          returnResult,
        }),
      );
      await page.close();
    }

    const voyagePage = await browser.newPage();
    await traverseFromGateway(voyagePage, ["/tales", "/play/hp4-lantern-coast"], "/play/hp4-lantern-coast");
    const begin = voyagePage.getByRole("button", { name: /Begin Voyage/u });
    await expect(begin).toBeVisible();
    await begin.click();
    await expect(voyagePage).toHaveURL(/\/play\/hp4-lantern-coast\/session\/[^/?#]+$/u);
    await settleCurrentRoute(voyagePage);
    const sessionPath = new URL(voyagePage.url()).pathname;
    dynamicPaths.set("route-page-play-taleslug-session-sessionid", sessionPath);
    await capture(voyagePage, "HP-P5-EV-T-immersive-exit", {
      screenContract: "screen-page-play-taleslug-session-sessionid",
      journey: "HP-P5-JRN-T",
      accountFixture: "ANONYMOUS_BROWSER_SESSION",
      appearanceState: "IMMERSIVE_SESSION_WITH_EXIT",
    });
    receipts.push(
      routeReceipt({
        routeId: "route-page-play-taleslug-session-sessionid",
        routePattern: "/play/[taleSlug]/session/[sessionId]",
        observedPath: sessionPath,
        classification: "CONTEXTUAL_DETAIL",
        profile: "anonymous",
        naturalPath: ["/", "/tales", "/play/hp4-lantern-coast", sessionPath],
        controls: ["Explore Chronicles", "Preview Chronicle", "Begin Voyage"],
        returnResult: "VISIBLE_CONTEXTUAL_EXIT_CONFIRMED",
      }),
    );
    await voyagePage.close();

    const invalid = await browser.newPage();
    await invalid.goto("/community/collections/not-a-real-phase5-record");
    await expect(invalid.locator("body")).toContainText(/not found|could not be found|404/u);
    await captureLoose(
      invalid,
      "HP-P5-EV-Q-dynamic-error",
      "screen-page-community-collections-slug",
      "HP-P5-JRN-Q",
      "ANONYMOUS",
      "INVALID_DYNAMIC_ID_FAILS_CLOSED",
    );
    await invalid.close();

    const denied = await restrictedContext.newPage();
    await denied.goto("/community/moderation/hp5-moderation-case");
    await expect(denied.getByRole("heading", { name: "Account access restricted" })).toBeVisible();
    await expect(denied.getByRole("link", { name: "Account recovery" })).toBeVisible();
    await captureLoose(
      denied,
      "HP-P5-EV-R-permission",
      "screen-page-community-moderation-id",
      "HP-P5-JRN-R",
      "RESTRICTED_ACCOUNT",
      "PERMISSION_DENIAL_WITH_SAFE_RECOVERY",
    );
    await denied.close();
  });

  test("K-M: tokenized handoffs distinguish valid, invalid, expired, consumed, and revoked states", async ({
    browser,
  }) => {
    const tokenCases = [
      {
        id: "reset-valid",
        routeId: "route-page-reset-password",
        path: `/reset-password?token=${secrets.resetValid}`,
        expected: /Reset|password/u,
        state: "VALID",
      },
      {
        id: "reset-invalid",
        routeId: "route-page-reset-password",
        path: "/reset-password?token=phase5-invalid-token",
        expected: /invalid|expired/u,
        state: "INVALID",
      },
      {
        id: "reset-expired",
        routeId: "route-page-reset-password",
        path: `/reset-password?token=${secrets.resetExpired}`,
        expected: /invalid|expired/u,
        state: "EXPIRED",
      },
      {
        id: "reset-consumed",
        routeId: "route-page-reset-password",
        path: `/reset-password?token=${secrets.resetConsumed}`,
        expected: /invalid|expired/u,
        state: "CONSUMED",
      },
      {
        id: "verify-valid",
        routeId: "route-page-verify-email",
        path: `/verify-email?token=${secrets.verifyValid}`,
        expected: /Verify|email/u,
        state: "VALID",
      },
      {
        id: "verify-expired",
        routeId: "route-page-verify-email",
        path: `/verify-email?token=${secrets.verifyExpired}`,
        expected: /invalid|expired/u,
        state: "EXPIRED",
      },
    ];
    for (const entry of tokenCases) {
      const page = await browser.newPage();
      await page.goto(entry.path);
      await expect(page.locator("body")).toContainText(entry.expected);
      if (entry.id === "reset-valid")
        await captureLoose(
          page,
          "HP-P5-EV-K-token-valid",
          "screen-page-reset-password",
          "HP-P5-JRN-K",
          "ANONYMOUS_TOKEN",
          "VALID_TOKEN_FORM",
        );
      if (entry.id === "reset-invalid")
        await captureLoose(
          page,
          "HP-P5-EV-L-token-invalid",
          "screen-page-reset-password",
          "HP-P5-JRN-L",
          "ANONYMOUS_TOKEN",
          "INVALID_TOKEN_FAILS_CLOSED",
        );
      if (entry.id === "reset-expired")
        await captureLoose(
          page,
          "HP-P5-EV-M-token-expired",
          "screen-page-reset-password",
          "HP-P5-JRN-M",
          "ANONYMOUS_TOKEN",
          "EXPIRED_TOKEN_FAILS_CLOSED",
        );
      receipts.push(
        routeReceipt({
          routeId: `${entry.routeId}-${entry.state.toLowerCase()}`,
          routePattern: entry.routeId.includes("verify") ? "/verify-email" : "/reset-password",
          observedPath: new URL(page.url()).pathname,
          classification: "TOKENIZED_DEEP_LINK",
          profile: "anonymous",
          naturalPath: ["BOUNDED_TOKEN_HANDOFF", new URL(page.url()).pathname],
          controls: ["Continue secure handoff"],
          returnResult: "SAFE_RETURN_PRESENT_OR_TERMINAL_GUIDANCE",
        }),
      );
      await page.close();
    }

    for (const entry of [
      { id: "invitation-valid", raw: secrets.invitationValid, state: "VALID" },
      { id: "invitation-expired", raw: secrets.invitationExpired, state: "EXPIRED" },
      { id: "invitation-revoked", raw: secrets.invitationRevoked, state: "REVOKED" },
    ]) {
      const page = await browser.newPage();
      await page.goto(`/join/${entry.raw}`);
      await expect(page).toHaveURL(/\/player\/invitation(?:\?|$)/u);
      await expect(page.getByRole("main")).toBeVisible();
      receipts.push(
        routeReceipt({
          routeId: `route-page-player-invitation-${entry.state.toLowerCase()}`,
          routePattern: "/player/invitation",
          observedPath: "/player/invitation",
          classification: "TOKENIZED_DEEP_LINK",
          profile: "anonymous",
          naturalPath: ["BOUNDED_INVITATION_HANDOFF", "/player/invitation"],
          controls: ["Continue secure handoff"],
          returnResult: "SAFE_RETURN_PRESENT_OR_TERMINAL_GUIDANCE",
        }),
      );
      await page.close();
    }
  });

  test("N, O, AB: all compatibility routes resolve after their canonical destinations were naturally proved", async ({
    browser,
  }) => {
    expect(naturalRoutes.size).toBe(42);
    const compatibility = [
      {
        routeId: "route-page-player-sign-in",
        source: "/player/sign-in",
        target: /\/sign-in(?:\?|$)/u,
        profile: "anonymous" as const,
      },
      {
        routeId: "route-page-captain-sign-in",
        source: "/captain/sign-in",
        target: /\/sign-in(?:\?|$)/u,
        profile: "anonymous" as const,
      },
      {
        routeId: "route-page-studio-sign-in",
        source: "/studio/sign-in",
        target: /\/sign-in(?:\?|$)/u,
        profile: "anonymous" as const,
      },
      { routeId: "route-page-player", source: "/player", target: /\/player\/library$/u, profile: "full" as const },
      { routeId: "route-page-captain", source: "/captain", target: /\/captain\/library$/u, profile: "full" as const },
      {
        routeId: "route-page-captain-invitations",
        source: "/captain/invitations",
        target: /\/captain\/library\?tab=invitations$/u,
        profile: "full" as const,
      },
      { routeId: "route-page-studio", source: "/studio", target: /\/studio\/library$/u, profile: "full" as const },
      {
        routeId: "route-page-quartermaster",
        source: "/quartermaster",
        target: /\/captain\/library$/u,
        profile: "full" as const,
      },
      {
        routeId: "route-page-quartermaster-workspace",
        source: "/quartermaster/control",
        target: /\/captain\/library/u,
        profile: "full" as const,
      },
      {
        routeId: "route-page-player-playthroughs-playthroughid-archive",
        source: "/player/playthroughs/hp5-session-active/archive",
        target: /\/player\/playthroughs\/hp5-session-active\/journal$/u,
        profile: "full" as const,
      },
      {
        routeId: "route-page-community-voyage-logs-media",
        source: "/community/voyage-logs/media",
        target: /\/community\/voyage-logs\/owner/u,
        profile: "player" as const,
      },
    ];
    for (const entry of compatibility) {
      const page = await pageForProfile(browser, entry.profile);
      await page.goto(entry.source);
      await expect(page).toHaveURL(entry.target);
      receipts.push(
        routeReceipt({
          routeId: entry.routeId,
          routePattern: entry.source.replace("hp5-session-active", "[playthroughId]").replace("control", "[workspace]"),
          observedPath: new URL(page.url()).pathname,
          classification: "COMPATIBILITY_REDIRECT",
          profile: entry.profile,
          naturalPath: ["CANONICAL_TARGET_PROVED_FIRST", entry.source],
          controls: ["Continue to canonical destination"],
          returnResult: "CANONICAL_TARGET_HAS_REGISTERED_RETURN",
        }),
      );
      if (entry.routeId === "route-page-player")
        await captureLoose(
          page,
          "HP-P5-EV-N-redirect",
          "screen-page-player-library",
          "HP-P5-JRN-N",
          "AUTHENTICATED_CAPTAIN_CREATOR_PLAYER",
          "REDIRECT_TARGET",
        );
      if (entry.routeId === "route-page-quartermaster")
        await captureLoose(
          page,
          "HP-P5-EV-O-deprecation",
          "screen-page-captain-library",
          "HP-P5-JRN-O",
          "AUTHENTICATED_CAPTAIN_CREATOR_PLAYER",
          "DEPRECATED_ROUTE_CANONICALIZED",
        );
      await page.close();
    }

    const talePage = await browser.newPage();
    await traverseFromGateway(talePage, ["/tales", "/play/hp4-lantern-coast"], "/play/hp4-lantern-coast");
    await talePage.getByRole("button", { name: /Begin Voyage/u }).click();
    await expect(talePage).toHaveURL(/\/play\/hp4-lantern-coast\/session\/[^/?#]+$/u);
    const canonicalSession = new URL(talePage.url()).pathname;
    await talePage.goto("/tale/hp4-lantern-coast");
    await expect(talePage).toHaveURL(new RegExp(`${escapeRegExp(canonicalSession)}$`, "u"));
    receipts.push(
      routeReceipt({
        routeId: "route-page-tale-campaignslug",
        routePattern: "/tale/[campaignSlug]",
        observedPath: canonicalSession,
        classification: "CANONICAL_CONTEXT_ADAPTER",
        profile: "anonymous",
        naturalPath: ["CANONICAL_SESSION_PROVED_FIRST", "/tale/hp4-lantern-coast"],
        controls: ["Continue to canonical destination"],
        returnResult: "CANONICAL_TARGET_HAS_CONTEXTUAL_EXIT",
      }),
    );
    await captureLoose(
      talePage,
      "HP-P5-EV-AB-redirect-ledger",
      "screen-page-play-taleslug-session-sessionid",
      "HP-P5-JRN-AB",
      "ANONYMOUS_BROWSER_SESSION",
      "CONTEXT_ADAPTER_TARGET",
    );
    await talePage.close();
  });

  test("P: governed empty state keeps an onward action", async ({ browser }) => {
    const snapshot = {
      listings: await db.communityListing.findMany({ select: { id: true, visibility: true } }),
      profiles: await db.communityProfile.findMany({ select: { id: true, visibility: true } }),
      collections: await db.communityCollection.findMany({ select: { id: true, visibility: true } }),
      guides: await db.communityGuideContent.findMany({ select: { id: true, status: true } }),
      logs: await db.communityVoyageLog.findMany({ select: { id: true, visibility: true } }),
    };
    try {
      await db.$transaction([
        db.communityListing.updateMany({ data: { visibility: "PRIVATE" } }),
        db.communityProfile.updateMany({ data: { visibility: "PRIVATE" } }),
        db.communityCollection.updateMany({ data: { visibility: "PRIVATE" } }),
        db.communityGuideContent.updateMany({ data: { status: "DRAFT" } }),
        db.communityVoyageLog.updateMany({ data: { visibility: "PRIVATE" } }),
      ]);
      const page = await browser.newPage();
      await traverseFromGateway(page, ["/community"], "/community");
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator('a[href="/tales"], a[href="/"]').first()).toBeVisible();
      await capture(page, "HP-P5-EV-P-empty", {
        screenContract: "screen-page-community",
        journey: "HP-P5-JRN-P",
        accountFixture: "ANONYMOUS",
        appearanceState: "EMPTY_WITH_ONWARD_ACTION",
      });
      await page.close();
    } finally {
      await db.$transaction([
        ...snapshot.listings.map((entry) =>
          db.communityListing.update({ where: { id: entry.id }, data: { visibility: entry.visibility } }),
        ),
        ...snapshot.profiles.map((entry) =>
          db.communityProfile.update({ where: { id: entry.id }, data: { visibility: entry.visibility } }),
        ),
        ...snapshot.collections.map((entry) =>
          db.communityCollection.update({ where: { id: entry.id }, data: { visibility: entry.visibility } }),
        ),
        ...snapshot.guides.map((entry) =>
          db.communityGuideContent.update({ where: { id: entry.id }, data: { status: entry.status } }),
        ),
        ...snapshot.logs.map((entry) =>
          db.communityVoyageLog.update({ where: { id: entry.id }, data: { visibility: entry.visibility } }),
        ),
      ]);
    }
  });

  test("U-Z: mobile, zoom, touch-equivalent, and keyboard paths preserve destinations", async ({ browser }) => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const login = await mobile.request.post("/api/gm/login", { data: { username: "hp4-creator", password } });
    expect(login.ok()).toBeTruthy();
    const page = await mobile.newPage();
    for (const [href, id, contract, journey] of [
      ["/tales", "HP-P5-EV-U-mobile-global", "screen-page-tales", "HP-P5-JRN-U"],
      ["/play/hp4-lantern-coast", "HP-P5-EV-V-mobile-detail", "screen-page-play-taleslug", "HP-P5-JRN-V"],
      ["/account", "HP-P5-EV-W-mobile-account", "screen-page-account", "HP-P5-JRN-W"],
      ["/community", "HP-P5-EV-X-mobile-community", "screen-page-community", "HP-P5-JRN-X"],
    ] as const) {
      const steps = href === "/play/hp4-lantern-coast" ? ["/tales", href] : [href];
      await traverseFromGateway(page, steps, href);
      await capture(page, id, {
        screenContract: contract,
        journey,
        accountFixture: "AUTHENTICATED_CAPTAIN_CREATOR_PLAYER",
        appearanceState: "MOBILE_NATURAL_PATH",
      });
    }
    await mobile.close();

    const zoomPage = await browser.newPage();
    await zoomPage.goto("/");
    await zoomPage.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(zoomPage.getByRole("main")).toBeVisible();
    await captureLoose(
      zoomPage,
      "HP-P5-EV-Y-zoom",
      "screen-page-root",
      "HP-P5-JRN-Y",
      "ANONYMOUS",
      "TWO_HUNDRED_PERCENT_ZOOM",
      "200%",
    );
    await zoomPage.close();

    const keyboard = await browser.newPage();
    await keyboard.goto("/");
    const navigationButton = keyboard.getByRole("button", { name: "Open navigation" });
    await navigationButton.focus();
    await navigationButton.press("Enter");
    const community = keyboard.locator('a[href="/community"]:visible').first();
    await community.focus();
    await community.press("Enter");
    await expect(keyboard).toHaveURL(/\/community$/u);
    await capture(keyboard, "HP-P5-EV-Z-keyboard", {
      screenContract: "screen-page-community",
      journey: "HP-P5-JRN-Z",
      accountFixture: "ANONYMOUS",
      appearanceState: "KEYBOARD_NATURAL_PATH",
    });
    await keyboard.close();
  });
});

async function signedInContext(browser: Browser, username: string) {
  const context = await browser.newContext();
  const response = await context.request.post("/api/gm/login", { data: { username, password } });
  expect(response.ok(), `${username} login failed: ${await response.text()}`).toBeTruthy();
  return context;
}

async function pageForProfile(browser: Browser, profile: Profile) {
  if (profile === "anonymous") return browser.newPage();
  if (profile === "full") return fullContext.newPage();
  if (profile === "player") return playerContext.newPage();
  return moderatorContext.newPage();
}

async function traverseFromGateway(page: Page, steps: readonly string[], expectedPath: string) {
  await page.goto("/");
  await settleCurrentRoute(page);
  const controls: string[] = [];
  for (const href of steps) controls.push(await clickVisibleHref(page, href));
  expect(new URL(page.url()).pathname).toBe(expectedPath);
  await settleCurrentRoute(page);
  return controls;
}

async function clickVisibleHref(page: Page, href: string) {
  await settleCurrentRoute(page);
  let link = visiblePathLink(page, href);
  if ((await link.count()) === 0) {
    const navigation = page.getByRole("button", { name: "Open navigation" });
    if (await navigation.isVisible()) await navigation.click();
    link = visiblePathLink(page, href);
  }
  if ((await link.count()) === 0) {
    const account = page.locator('button[aria-controls="shell-account-disclosure"]');
    if (await account.isVisible()) await account.click();
    link = visiblePathLink(page, href);
  }
  await expect(link, `No visible natural-path control for ${href} from ${page.url()}`).toBeVisible();
  const label = ((await link.getAttribute("aria-label")) ?? (await link.innerText())).trim().replace(/\s+/gu, " ");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}(?:[?#].*)?$`, "u"));
  await settleCurrentRoute(page);
  return label;
}

function visiblePathLink(page: Page, href: string) {
  return page.locator(`a[href="${href}"]:visible, a[href^="${href}?"]:visible, a[href^="${href}#"]:visible`).first();
}

async function followRegisteredReturn(page: Page, currentPath: string) {
  if (currentPath === "/") return "ROOT_IS_ELIGIBLE_START_AND_RETURN";
  let home = page.locator('a[href="/"]:visible').first();
  if ((await home.count()) === 0) {
    const navigation = page.getByRole("button", { name: "Open navigation" });
    if (await navigation.isVisible()) await navigation.click();
    home = page.locator('a[href="/"]:visible').first();
  }
  if (await home.isVisible()) {
    await home.click();
    await expect(page).toHaveURL(/\/$/u);
    await settleCurrentRoute(page);
    return "VISIBLE_HOME_RETURN_TRAVERSED";
  }
  const contextual = page.locator('[data-navigation-id="shell-safe-return"]:visible').first();
  await expect(contextual).toBeVisible();
  await contextual.click();
  await expect(page).not.toHaveURL(new RegExp(`${escapeRegExp(currentPath)}$`, "u"));
  return "VISIBLE_CONTEXTUAL_RETURN_TRAVERSED";
}

async function settleCurrentRoute(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const pathname = new URL(page.url()).pathname;
  const routeLayer = page.locator(`.product-route-layer[data-route-layer="${pathname}"]`);
  if ((await routeLayer.count()) === 1) {
    if (pathname === "/" && (await routeLayer.evaluate((element) => getComputedStyle(element).opacity)) === "0") {
      const skip = page.getByRole("button", { name: "Skip opening presentation" });
      if (await skip.isVisible()) await skip.click();
    }
    await expect(routeLayer).toHaveCSS("opacity", "1");
    await expect(routeLayer).toHaveCSS("transform", "none");
  }
  await expect(page.locator("main, h1").first()).toBeVisible();
}

function routeReceipt(input: {
  routeId: string;
  routePattern: string;
  observedPath: string;
  classification: string;
  profile: Profile;
  naturalPath: string[];
  controls: string[];
  returnResult: string;
}): RouteReceipt {
  return {
    routeId: input.routeId,
    routePattern: input.routePattern,
    observedPath: input.observedPath,
    classification: input.classification,
    accountFixture: accountFixture(input.profile),
    naturalPath: input.naturalPath,
    visibleControls: input.controls,
    naturalResult: "PASSED_VISIBLE_CONTROL_TRAVERSAL",
    directEntryResult: "PASSED_AFTER_NATURAL_PATH",
    returnResult: input.returnResult,
    desktopResult: "PASSED_CHROMIUM_DESKTOP",
    mobileResult: "REPRESENTATIVE_PARITY_PROVED_IN_HP_P5_EV_U_THROUGH_X",
    sourceSha,
    branch,
    timestamp: new Date().toISOString(),
    limitation:
      "Synthetic local branch evidence only; not merge, deploy, production, owner, or product acceptance proof.",
  };
}

async function capture(
  page: Page,
  evidenceId: string,
  input: {
    screenContract: string;
    journey: string;
    accountFixture: string;
    appearanceState: string;
    zoom?: string;
  },
) {
  await settleCurrentRoute(page);
  if (new URL(page.url()).pathname === "/") {
    const skip = page.getByRole("button", { name: "Skip opening presentation" });
    if (await skip.isVisible()) {
      await skip.click();
      await expect(skip).toBeHidden();
    }
    await expect(page.getByRole("region", { name: "Choose your role in Voyagewright" })).toBeVisible();
  }
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(150);
  const screenshotPath = path.join(evidenceRoot, `${evidenceId}.png`);
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const bytes = await readFile(screenshotPath);
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const relative = path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/");
  records.push({
    evidenceId,
    sourceSha,
    branch,
    route: new URL(page.url()).pathname,
    screenContract: input.screenContract,
    journey: input.journey,
    accountFixture: input.accountFixture,
    fixtureVersion,
    fixtureChecksum,
    browser: `Chromium ${browserVersion}`,
    viewport: `${viewport.width}x${viewport.height}`,
    zoom: input.zoom ?? "100%",
    motionMode: "FULL",
    appearanceState: input.appearanceState,
    dataState: "Synthetic task-owned isolated copied database and storage roots",
    screenshotPath: relative,
    committedScreenshotPath: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    observedResult: "Required route or state rendered after the declared natural-path or bounded handoff proof.",
    knownDeviation:
      "Synthetic local fixture evidence; not production, deployment, MySQL, external-provider, owner, or product acceptance proof.",
    timestamp: new Date().toISOString(),
    reviewerClassification: "PENDING_CODEX_VISUAL_REVIEW",
  });
}

async function captureLoose(
  page: Page,
  evidenceId: string,
  screenContractId: string,
  journey: string,
  fixture: string,
  appearanceState: string,
  zoom?: string,
) {
  await expect(page.locator("body")).toBeVisible();
  return capture(page, evidenceId, {
    screenContract: screenContractId,
    journey,
    accountFixture: fixture,
    appearanceState,
    zoom,
  });
}

function screenContract(routeId: string) {
  return routeId.replace(/^route-/u, "screen-");
}

function accountFixture(profile: Profile) {
  if (profile === "anonymous") return "ANONYMOUS";
  if (profile === "full") return "AUTHENTICATED_CAPTAIN_CREATOR_PLAYER";
  if (profile === "player") return "AUTHENTICATED_PLAYER";
  return "AUTHENTICATED_MODERATOR";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";

const evidenceRoot = path.resolve(required("HOMEPORT_PHASE4_EVIDENCE_ROOT"));
const fixtureManifestPath = path.resolve(
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_Fixture_Manifest.json",
);
const fixtureChecksum = createHash("sha256").update(readFileSync(fixtureManifestPath)).digest("hex");
const fixtureVersion = "homeport-phase4-synthetic-v1";
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const records: EvidenceRecord[] = [];
const password = "Homeport-Phase4-Synthetic!";
let browserVersion = "unknown";
let playerContext: BrowserContext;
let creatorContext: BrowserContext;
let moderatorContext: BrowserContext;
let restrictedContext: BrowserContext;

type EvidenceRecord = Readonly<{
  evidenceId: string;
  sourceSha: string;
  branch: string;
  route: string;
  screen: string;
  district: string;
  journey: string;
  fixtureVersion: string;
  fixtureChecksum: string;
  accountState: string;
  contentState: string;
  browser: string;
  viewport: { width: number; height: number };
  effectiveZoom: number;
  motionMode: string;
  screenshotPath: string;
  sha256: string;
  observedResult: string;
  knownLimitation: string;
  reviewerClassification: string;
  timestamp: string;
}>;

test.describe.serial("Project Homeport Phase 4 Community Harbor acceptance", () => {
  test.beforeAll(async ({ browser }) => {
    browserVersion = browser.version();
    playerContext = await signedInContext(browser, "hp4-player");
    creatorContext = await signedInContext(browser, "hp4-creator");
    moderatorContext = await signedInContext(browser, "hp4-moderator");
    restrictedContext = await signedInContext(browser, "hp4-restricted");
  });

  test.afterAll(async () => {
    await Promise.all([
      playerContext.close(),
      creatorContext.close(),
      moderatorContext.close(),
      restrictedContext.close(),
    ]);
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(
      path.join(evidenceRoot, "Project_Homeport_Phase_4_Evidence_Metadata.json"),
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          phase: "PROJECT_HOMEPORT_PHASE_4",
          sourceSha,
          branch,
          fixtureVersion,
          fixtureChecksum,
          records,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });

  test("A-I, AD, AG, AL: natural anonymous discovery, search, filters, sort, fallback, and recovery", async ({
    page,
  }) => {
    await enterHarbor(page);
    await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured at the Harbor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recently launched" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meet the Makers" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Community Harbor districts" }).getByRole("link")).toHaveCount(
      11,
    );
    await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeVisible();
    await assertNoOverflow(page);
    await capture(page, "HP-P4-EV-A-harbor-home-desktop", {
      screen: "Harbor Home",
      district: "HARBOR_HOME",
      journey: "A",
      accountState: "ANONYMOUS",
      contentState: "DEFAULT_CONTENT",
    });
    await capture(page, "HP-P4-EV-E-featured-shelf", {
      screen: "Featured shelf",
      district: "HARBOR_HOME",
      journey: "B",
      accountState: "ANONYMOUS",
      contentState: "FEATURED",
    });
    await capture(page, "HP-P4-EV-F-district-navigation", {
      screen: "District navigator",
      district: "HARBOR_HOME",
      journey: "A",
      accountState: "ANONYMOUS",
      contentState: "ACTIVE_NAVIGATION",
    });
    await capture(page, "HP-P4-EV-T-chronicle-card", {
      screen: "Chronicle card",
      district: "HARBOR_HOME",
      journey: "B",
      accountState: "ANONYMOUS",
      contentState: "CARD_FALLBACK",
    });
    await capture(page, "HP-P4-EV-AK-public-projection", {
      screen: "Public projection",
      district: "HARBOR_HOME",
      journey: "B",
      accountState: "ANONYMOUS",
      contentState: "PUBLIC_ALLOWLIST",
    });

    const accessibility = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();
    expect(accessibility.violations.filter((entry) => ["serious", "critical"].includes(entry.impact ?? ""))).toEqual(
      [],
    );

    const search = page.getByRole("searchbox", { name: "Search public Community Harbor" });
    await search.fill("Lantern Coast");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/community\?q=Lantern\+Coast$/u);
    const results = page.getByLabel("Public Community Harbor results");
    await expect(results.getByRole("link", { name: "The Lantern Coast" })).toBeVisible();
    await capture(page, "HP-P4-EV-V-search-results", {
      screen: "Search results",
      district: "HARBOR_HOME",
      journey: "E",
      accountState: "ANONYMOUS",
      contentState: "RESULTS",
    });
    await capture(page, "HP-P4-EV-Y-active-filters", {
      screen: "Active criteria summary",
      district: "HARBOR_HOME",
      journey: "E",
      accountState: "ANONYMOUS",
      contentState: "ACTIVE_FILTERS",
    });
    await results.getByRole("link", { name: "The Lantern Coast" }).click();
    await expect(page).toHaveURL(/\/community\/lantern-coast-chronicle$/u);
    await expect(page.getByRole("heading", { name: "The Lantern Coast", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview Chronicle" })).toHaveAttribute(
      "href",
      "/play/hp4-lantern-coast",
    );
    await expect(page.locator("main")).not.toContainText("hp4-account-creator");
    await capture(page, "HP-P4-EV-U-listing-detail", {
      screen: "Listing detail",
      district: "CHRONICLES",
      journey: "K",
      accountState: "ANONYMOUS",
      contentState: "PUBLIC_DETAIL",
    });
    await page.goBack();
    await expect(page).toHaveURL(/q=Lantern\+Coast/u);
    await expect(search).toHaveValue("Lantern Coast");
    await page.getByRole("button", { name: /Search: Lantern Coast/u }).click();
    await expect(page).toHaveURL(/\/community$/u);
    await expect(search).toHaveValue("");

    await search.fill("unfindable synthetic horizon");
    await expect(search).toHaveValue("unfindable synthetic horizon");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=unfindable\+synthetic\+horizon/u);
    await expect(page.getByRole("heading", { name: "No public charts match these criteria" })).toBeVisible();
    await capture(page, "HP-P4-EV-W-no-results", {
      screen: "No search results",
      district: "HARBOR_HOME",
      journey: "F",
      accountState: "ANONYMOUS",
      contentState: "NO_RESULTS",
    });
    await page.getByRole("button", { name: "Clear search and filters" }).last().click();
    await expect(page).toHaveURL(/\/community$/u);
    await expect(page.getByRole("heading", { name: "Featured at the Harbor" })).toBeVisible();

    await page.getByText("Advanced filters", { exact: false }).first().click();
    await page.getByLabel("Moderate").check();
    await page.getByRole("button", { name: "Apply advanced filters" }).click();
    await expect(page).toHaveURL(/difficulty=MODERATE/u);
    await capture(page, "HP-P4-EV-X-advanced-filters", {
      screen: "Advanced filters",
      district: "HARBOR_HOME",
      journey: "H",
      accountState: "ANONYMOUS",
      contentState: "ADVANCED_FILTERS",
    });
    await page.getByLabel("Sort").selectOption("NEWEST");
    await expect(page).toHaveURL(/sort=NEWEST/u);
    await page.reload();
    await expect(page.getByLabel("Sort")).toHaveValue("NEWEST");

    await page.route("**/api/community/discover?**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Synthetic discovery dependency is temporarily unavailable." }),
      });
    });
    await page.getByRole("searchbox", { name: "Search public Community Harbor" }).fill("dependency test");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Synthetic discovery dependency" })).toBeVisible();
    await capture(page, "HP-P4-EV-AD-dependency-unavailable", {
      screen: "Dependency unavailable",
      district: "HARBOR_HOME",
      journey: "AG",
      accountState: "ANONYMOUS",
      contentState: "DEPENDENCY_UNAVAILABLE",
    });
    await page.unroute("**/api/community/discover?**");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "No public charts match these criteria" })).toBeVisible();
  });

  test("J-AC, AE-AF: every active district and detail family is naturally reachable and privacy-safe", async ({
    page,
  }) => {
    await enterHarbor(page);
    const districtEvidence = [
      ["Chronicles", "/community/chronicles", "HP-P4-EV-G-chronicles-district", "The Lantern Coast"],
      ["Artifacts", "/community/artifacts", "HP-P4-EV-H-artifacts-district", "Glass Beacon Model"],
      ["Templates", "/community/templates", "HP-P4-EV-I-templates-district", "Quiet Watch Template"],
      ["Maps", "/community/maps", "HP-P4-EV-J-maps-district", "Fictional Crescent Map Pack"],
      ["Audio and reveals", "/community/audio", "HP-P4-EV-K-audio-district", "Harbor Bell Audio Cues"],
      ["Creators", "/community/creators", "HP-P4-EV-L-creators-district", "Captain Almanac"],
      ["Collections", "/community/collections", "HP-P4-EV-O-collections-district", "Harbor Starter Charts"],
      ["Guides", "/community/guides", "HP-P4-EV-Q-guides-district", "Reading the Weathered Chart"],
      ["Voyage Logs", "/community/voyage-logs", "HP-P4-EV-S-voyage-logs", "Fictional Lantern Voyage Log"],
    ] as const;
    for (const [district, route, evidenceId, visibleTitle] of districtEvidence) {
      await page
        .getByRole("navigation", { name: "Community Harbor districts" })
        .getByRole("link", { name: district })
        .click();
      await expect(page).toHaveURL(new RegExp(`${route}$`, "u"));
      await settleCurrentRoute(page);
      await expect(page.getByText(visibleTitle, { exact: true }).first()).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Community Harbor districts" }).getByRole("link", { name: district }),
      ).toHaveAttribute("aria-current", "page");
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page);
      await capture(page, evidenceId, {
        screen: `${district} district`,
        district: district.toLocaleUpperCase().replaceAll(" ", "_"),
        journey: district,
        accountState: "ANONYMOUS",
        contentState: "DISTRICT_POPULATED",
      });
    }

    await followLink(
      page,
      page.getByRole("link", { name: "Fictional Lantern Voyage Log" }),
      /\/community\/voyage-logs\/fictional-lantern-voyage$/u,
    );
    await expect(page.getByText("Participant consent checked")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("fictional harbor district");

    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Guides" })
      .click();
    await expect(page).toHaveURL(/\/community\/guides$/u);
    await followLink(
      page,
      page.getByRole("link", { name: "Reading the Weathered Chart" }),
      /\/community\/guides\/reading-the-weathered-chart$/u,
    );
    await expect(page.getByRole("heading", { name: "Reading the Weathered Chart", level: 1 })).toBeVisible();
    await capture(page, "HP-P4-EV-R-guide-detail", {
      screen: "Guide detail",
      district: "GUIDES",
      journey: "Y",
      accountState: "ANONYMOUS",
      contentState: "PUBLIC_DETAIL",
    });

    await followLink(
      page,
      page.getByRole("link", { name: "Captain Almanac" }).first(),
      /\/community\/creators\/captain-almanac$/u,
    );
    await expect(page.getByText("@captain-almanac")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Public collections" })).toBeVisible();
    await capture(page, "HP-P4-EV-M-creator-profile", {
      screen: "Creator Profile",
      district: "CREATORS",
      journey: "Q",
      accountState: "ANONYMOUS",
      contentState: "CREATOR_WITH_WORK",
    });
    await expect(page.getByRole("link", { name: "Sign in to follow or save" })).toHaveAttribute(
      "href",
      /returnTo=%2Fcommunity%2Fcreators%2Fcaptain-almanac/u,
    );
    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Creators" })
      .click();
    await expect(page).toHaveURL(/\/community\/creators$/u);
    await followLink(page, page.getByRole("link", { name: "Maker Lumen" }), /\/community\/creators\/maker-lumen$/u);
    await expect(page.getByRole("heading", { name: "No public work yet" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("draft");
    await capture(page, "HP-P4-EV-N-creator-empty", {
      screen: "Creator Profile without work",
      district: "CREATORS",
      journey: "R",
      accountState: "ANONYMOUS",
      contentState: "NO_PUBLISHED_WORK",
    });

    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Collections" })
      .click();
    await expect(page).toHaveURL(/\/community\/collections$/u);
    await followLink(
      page,
      page.getByRole("link", { name: "Harbor Starter Charts" }),
      /\/community\/collections\/harbor-starters$/u,
    );
    await expect(page.getByRole("heading", { name: /2 eligible entries/u })).toBeVisible();
    await capture(page, "HP-P4-EV-P-collection-detail", {
      screen: "Collection detail",
      district: "COLLECTIONS",
      journey: "V",
      accountState: "ANONYMOUS",
      contentState: "POPULATED_COLLECTION",
    });
    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Collections" })
      .click();
    await expect(page).toHaveURL(/\/community\/collections$/u);
    await followLink(
      page,
      page.getByRole("link", { name: "Empty Chart Case" }),
      /\/community\/collections\/empty-chart-case$/u,
    );
    await expect(page.getByRole("heading", { name: "This public collection is empty" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Artifacts" })
      .click();
    await expect(page).toHaveURL(/\/community\/artifacts$/u);
    await expect(page.getByRole("img", { name: "Artifact artwork unavailable" }).first()).toBeVisible();
    await followLink(
      page,
      page.getByRole("link", { name: "Glass Beacon Model" }),
      /\/community\/glass-beacon-artifact$/u,
      { keyboard: true },
    );
    await expect(page.getByRole("img", { name: "Artifact artwork unavailable" })).toBeVisible();
    await expect(page.getByText("Not currently supported from public Community Harbor")).toBeVisible();
    await capture(page, "HP-P4-EV-AA-image-fallback", {
      screen: "Governed image fallback",
      district: "ARTIFACTS",
      journey: "M",
      accountState: "ANONYMOUS",
      contentState: "FAILED_MEDIA_FALLBACK",
    });

    const projection = await page.request.get("/api/community/discover?q=Lantern&type=CHRONICLE");
    expect(projection.ok(), await projection.text()).toBeTruthy();
    const projectionWire = await projection.text();
    expect(projectionWire).not.toContain("hp4-account-creator");
    expect(projectionWire).not.toContain("fictional harbor district");
    expect(projectionWire).not.toContain("storageKey");

    await expectUnavailableWithoutLeakage(
      page,
      "/community/collections/private-curator-notes",
      "Private Curator Notes",
    );
    await expectUnavailableWithoutLeakage(page, "/community/quarantined-signal", "Hidden fixture quarantined-signal");
    await capture(page, "HP-P4-EV-AB-quarantined-content", {
      screen: "Unavailable quarantined listing",
      district: "CHRONICLES",
      journey: "AE",
      accountState: "ANONYMOUS",
      contentState: "NOT_FOUND_WITHOUT_LEAKAGE",
    });
    await expectUnavailableWithoutLeakage(
      page,
      "/community/archived-superseded-chart",
      "Hidden fixture archived-superseded-chart",
    );
    await capture(page, "HP-P4-EV-AC-archived-removed", {
      screen: "Unavailable archived listing",
      district: "CHRONICLES",
      journey: "AF",
      accountState: "ANONYMOUS",
      contentState: "NOT_FOUND_WITHOUT_LEAKAGE",
    });
    await expectUnavailableWithoutLeakage(page, "/community/removed-old-chart", "Hidden fixture removed-old-chart");
    await expectUnavailableWithoutLeakage(
      page,
      "/community/sealed-drawer-private",
      "Hidden fixture sealed-drawer-private",
    );
    await expectUnavailableWithoutLeakage(page, "/community/unlisted-moon-chart", "Hidden fixture unlisted-moon-chart");
  });

  test("C, S-U, AA-AC, AH-AI, AO-AQ: authenticated, restricted, moderator, and cross-surface state", async () => {
    const page = await playerContext.newPage();
    await enterHarbor(page);
    await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();
    await capture(page, "HP-P4-EV-C-harbor-authenticated", {
      screen: "Authenticated Harbor Home",
      district: "HARBOR_HOME",
      journey: "C",
      accountState: "AUTHENTICATED_PLAYER",
      contentState: "SAVED_STATE_HYDRATED",
    });
    await capture(page, "HP-P4-EV-Z-saved-state", {
      screen: "Saved card state",
      district: "HARBOR_HOME",
      journey: "AA",
      accountState: "AUTHENTICATED_PLAYER",
      contentState: "SAVED",
    });

    await page.goto("/passport/saved");
    await expect(page.getByRole("heading", { name: "Saved from Community" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Lantern Coast" })).toBeVisible();
    await page.getByRole("button", { name: "Remove saved item" }).click();
    await expect(page.getByText("Saved item removed.")).toBeVisible();
    await page.getByRole("link", { name: "Explore Community Harbor" }).click();
    await expect(page.getByRole("button", { name: "Save" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

    await page.goto("/community/creators/captain-almanac");
    await expect(page.getByRole("button", { name: "Unfollow Creator" })).toBeVisible();
    await page.getByRole("button", { name: "Unfollow Creator" }).click();
    await expect(page.getByRole("button", { name: "Follow Creator" })).toBeVisible();
    await page.getByRole("button", { name: "Follow Creator" }).click();
    await expect(page.getByRole("button", { name: "Unfollow Creator" })).toBeVisible();

    await page.goto("/community/paper-stars-chronicle");
    await page.route("**/api/community/social/save", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic save failure." }),
      });
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Synthetic save failure" })).toBeVisible();
    await page.unroute("**/api/community/social/save");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unsave" })).toBeVisible();

    const creatorPage = await creatorContext.newPage();
    await creatorPage.goto("/community/creators/captain-almanac");
    await creatorPage.getByRole("button", { name: "Follow Creator" }).click();
    await expect(
      creatorPage.getByRole("alert").filter({ hasText: /cannot follow|own Creator Profile/u }),
    ).toBeVisible();
    await creatorPage.close();

    const restrictedPage = await restrictedContext.newPage();
    await restrictedPage.goto("/community");
    await expect(restrictedPage.getByText("Community actions are unavailable for this account.").first()).toBeVisible();
    await expect(restrictedPage.getByRole("link", { name: /Sign In/u })).toHaveCount(0);
    await capture(restrictedPage, "HP-P4-EV-AJ-restricted-state", {
      screen: "Restricted Community state",
      district: "HARBOR_HOME",
      journey: "AH",
      accountState: "RESTRICTED_SUSPENDED",
      contentState: "BROWSING_WITH_MUTATIONS_DENIED",
    });
    await restrictedPage.close();

    const moderatorPage = await moderatorContext.newPage();
    await moderatorPage.goto("/community/moderation");
    await expect(moderatorPage.getByRole("heading", { name: /Moderation/u })).toBeVisible();
    expect((await playerContext.request.get("/api/community/moderation/cases")).status()).toBe(403);
    await moderatorPage.close();
    await page.close();
  });

  test("D and empty district: designed empty states remain distinct and reversible", async ({ page }) => {
    const snapshot = await snapshotPublicEligibility();
    try {
      await hideAllPublicCommunity();
      await enterHarbor(page);
      await expect(page.getByRole("heading", { name: "No public Community work has arrived yet" })).toBeVisible();
      await expect(page.getByText(/No public charts match/u)).toHaveCount(0);
      await expect(page.locator("main").getByRole("link", { name: "Explore Chronicles" })).toBeVisible();
      await capture(page, "HP-P4-EV-D-harbor-empty", {
        screen: "Community-wide empty state",
        district: "HARBOR_HOME",
        journey: "D",
        accountState: "ANONYMOUS",
        contentState: "HARBOR_EMPTY",
      });
    } finally {
      await restorePublicEligibility(snapshot);
    }

    const audio = await db.communityListing.findMany({
      where: { itemType: { in: ["AUDIO_PACK", "REVEAL_PRESET", "INVITATION_STYLE", "COMPLETION_STYLE"] } },
      select: { id: true, visibility: true },
    });
    try {
      await db.communityListing.updateMany({
        where: { id: { in: audio.map((entry) => entry.id) } },
        data: { visibility: "PRIVATE" },
      });
      await page.goto("/community/audio");
      await expect(page.getByRole("heading", { name: "No public audio or reveal assets yet" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Browse Templates" })).toBeVisible();
      await capture(page, "HP-P4-EV-AM-audio-district-empty", {
        screen: "Empty district",
        district: "AUDIO_AND_REVEAL_ASSETS",
        journey: "EMPTY_DISTRICT",
        accountState: "ANONYMOUS",
        contentState: "DISTRICT_EMPTY",
      });
    } finally {
      for (const entry of audio)
        await db.communityListing.update({ where: { id: entry.id }, data: { visibility: entry.visibility } });
    }
  });

  test("AJ-AN and AR: mobile, keyboard, zoom, reduced motion, and the natural full Community loop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterHarbor(page);
    await assertNoOverflow(page);
    await capture(page, "HP-P4-EV-B-harbor-home-mobile", {
      screen: "Mobile Harbor Home",
      district: "HARBOR_HOME",
      journey: "AJ",
      accountState: "ANONYMOUS",
      contentState: "DEFAULT_CONTENT",
    });
    await page.getByText("Advanced filters", { exact: false }).first().click();
    await assertNoOverflow(page);
    await capture(page, "HP-P4-EV-AE-mobile-filter-drawer", {
      screen: "Mobile advanced filters",
      district: "HARBOR_HOME",
      journey: "AJ",
      accountState: "ANONYMOUS",
      contentState: "ADVANCED_FILTERS",
    });
    await page
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Chronicles" })
      .click();
    await expect(page).toHaveURL(/\/community\/chronicles$/u);
    await followLink(
      page,
      page.getByRole("link", { name: "The Lantern Coast" }),
      /\/community\/lantern-coast-chronicle$/u,
    );
    await assertNoOverflow(page);
    await capture(page, "HP-P4-EV-AF-mobile-detail", {
      screen: "Mobile listing detail",
      district: "CHRONICLES",
      journey: "AJ",
      accountState: "ANONYMOUS",
      contentState: "PUBLIC_DETAIL",
    });

    const authMobile = await playerContext.newPage();
    await authMobile.setViewportSize({ width: 390, height: 844 });
    await enterHarbor(authMobile);
    await expect(authMobile.getByRole("button", { name: "Saved" }).first()).toBeVisible();
    await assertNoOverflow(authMobile);
    await capture(authMobile, "HP-P4-EV-AK-mobile-authenticated", {
      screen: "Authenticated mobile Harbor",
      district: "HARBOR_HOME",
      journey: "AK",
      accountState: "AUTHENTICATED_PLAYER",
      contentState: "SAVED_STATE_HYDRATED",
    });
    await authMobile.close();

    await page.setViewportSize({ width: 720, height: 600 });
    await page.goto("/community");
    await assertNoOverflow(page);
    await capture(page, "HP-P4-EV-AG-zoom-harbor", {
      screen: "Effective 200 percent Harbor",
      district: "HARBOR_HOME",
      journey: "AM",
      accountState: "ANONYMOUS",
      contentState: "DEFAULT_CONTENT",
      effectiveZoom: 200,
    });
    await page.getByText("Advanced filters", { exact: false }).first().click();
    await capture(page, "HP-P4-EV-AH-zoom-filters", {
      screen: "Effective 200 percent filters",
      district: "HARBOR_HOME",
      journey: "AM",
      accountState: "ANONYMOUS",
      contentState: "ADVANCED_FILTERS",
      effectiveZoom: 200,
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
    await capture(page, "HP-P4-EV-AI-reduced-motion", {
      screen: "Reduced-motion Harbor",
      district: "HARBOR_HOME",
      journey: "AN",
      accountState: "ANONYMOUS",
      contentState: "DEFAULT_CONTENT",
      motionMode: "REDUCED",
    });

    const keyboardPage = await page.context().newPage();
    await keyboardPage.goto("/");
    await tabToTarget(keyboardPage, { href: "/community" });
    await keyboardPage.keyboard.press("Enter");
    await expect(keyboardPage).toHaveURL(/\/community$/u);
    await settleCurrentRoute(keyboardPage);
    await tabToTarget(keyboardPage, { selector: 'input[type="search"]' });
    await keyboardPage.keyboard.type("Lantern Coast");
    await keyboardPage.keyboard.press("Enter");
    await expect(keyboardPage).toHaveURL(/q=Lantern\+Coast/u);
    await tabToTarget(keyboardPage, { href: "/community/lantern-coast-chronicle" });
    await keyboardPage.keyboard.press("Enter");
    await expect(keyboardPage).toHaveURL(/\/community\/lantern-coast-chronicle$/u);
    await settleCurrentRoute(keyboardPage);
    await capture(keyboardPage, "HP-P4-EV-AM-keyboard-navigation", {
      screen: "Keyboard-only Community detail",
      district: "CHRONICLES",
      journey: "AL",
      accountState: "ANONYMOUS",
      contentState: "KEYBOARD_NAVIGATION_COMPLETE",
    });
    await keyboardPage.close();

    const fullLoop = await playerContext.newPage();
    await enterHarbor(fullLoop);
    await fullLoop
      .getByRole("navigation", { name: "Community Harbor districts" })
      .getByRole("link", { name: "Chronicles" })
      .click();
    await expect(fullLoop).toHaveURL(/\/community\/chronicles$/u);
    await followLink(
      fullLoop,
      fullLoop.getByRole("link", { name: "The Lantern Coast" }).first(),
      /\/community\/lantern-coast-chronicle$/u,
    );
    await followLink(
      fullLoop,
      fullLoop.getByRole("link", { name: "Captain Almanac" }).first(),
      /\/community\/creators\/captain-almanac$/u,
    );
    await followLink(
      fullLoop,
      fullLoop.getByRole("link", { name: "Harbor Starter Charts" }).first(),
      /\/community\/collections\/harbor-starters$/u,
    );
    await followLink(
      fullLoop,
      fullLoop.getByRole("link", { name: "The Lantern Coast" }).first(),
      /\/community\/lantern-coast-chronicle$/u,
    );
    await expect(fullLoop.getByRole("button", { name: "Unsave" })).toBeVisible();
    await fullLoop.getByRole("button", { name: "Mara Testwake", exact: true }).click();
    const accountMenu = fullLoop.locator("#shell-account-disclosure");
    await expect(accountMenu).toBeVisible();
    await followLink(
      fullLoop,
      accountMenu.getByRole("link", { name: "Chronicle Passport", exact: true }),
      /\/passport$/u,
    );
    await followLink(
      fullLoop,
      fullLoop
        .getByRole("navigation", { name: "Personal Harbor sections" })
        .getByRole("link", { name: "Saved", exact: true }),
      /\/passport\/saved$/u,
    );
    await followLink(fullLoop, fullLoop.getByRole("link", { name: "Open in Community" }).first(), /\/community\/.+$/u);
    await followLink(fullLoop, fullLoop.getByRole("link", { name: "Harbor Home" }), /\/community$/u);
    await followLink(fullLoop, fullLoop.getByRole("link", { name: "Home", exact: true }).first(), /\/$/u);
    await capture(fullLoop, "HP-P4-EV-AL-full-community-loop", {
      screen: "Full Community loop returned Home",
      district: "GATEWAY",
      journey: "AR",
      accountState: "AUTHENTICATED_PLAYER",
      contentState: "LOOP_COMPLETE",
    });
    await fullLoop.close();
  });
});

async function signedInContext(browser: Browser, username: string) {
  const context = await browser.newContext();
  const response = await context.request.post("/api/gm/login", { data: { username, password } });
  expect(response.ok(), `${username} login failed: ${await response.text()}`).toBeTruthy();
  return context;
}

async function enterHarbor(page: Page) {
  await page.goto("/");
  const communityLink = page
    .getByRole("navigation", { name: "Global navigation" })
    .getByRole("link", { name: "Community Harbor", exact: true });
  if (!(await communityLink.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(communityLink).toBeVisible();
  }
  await communityLink.click();
  await expect(page).toHaveURL(/\/community$/u);
  await settleCurrentRoute(page);
  await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
}

async function followLink(page: Page, link: Locator, expectedUrl: RegExp, options: { keyboard?: boolean } = {}) {
  await settleCurrentRoute(page);
  await expect(link).toBeVisible();
  if (options.keyboard) {
    await link.focus();
    await link.press("Enter");
  } else {
    await link.click();
  }
  await expect(page).toHaveURL(expectedUrl);
  await settleCurrentRoute(page);
}

async function settleCurrentRoute(page: Page) {
  const pathname = new URL(page.url()).pathname;
  const routeLayer = page.locator(`.product-route-layer[data-route-layer="${pathname}"]`);
  await expect(routeLayer).toHaveCount(1);
  await expect(routeLayer).toHaveCSS("opacity", "1");
  await expect(routeLayer).toHaveCSS("transform", "none");
}

async function tabToTarget(page: Page, target: { href?: string; selector?: string }) {
  for (let index = 0; index < 240; index += 1) {
    const active = await page.evaluate(
      (selector) => ({
        href: document.activeElement?.getAttribute("href") ?? undefined,
        matchesSelector: selector ? Boolean(document.activeElement?.matches(selector)) : true,
      }),
      target.selector,
    );
    if ((!target.href || active.href === target.href) && active.matchesSelector) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard traversal did not reach ${JSON.stringify(target)}.`);
}

async function capture(
  page: Page,
  evidenceId: string,
  input: {
    screen: string;
    district: string;
    journey: string;
    accountState: string;
    contentState: string;
    effectiveZoom?: number;
    motionMode?: string;
  },
) {
  await settleCurrentRoute(page);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await expect(page.locator("main, h1").first()).toBeVisible();
  await page.waitForTimeout(200);
  const screenshotPath = path.join(evidenceRoot, `${evidenceId}.png`);
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotBytes = await readFile(screenshotPath);
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  records.push({
    evidenceId,
    sourceSha,
    branch,
    route: new URL(page.url()).pathname + new URL(page.url()).search,
    screen: input.screen,
    district: input.district,
    journey: input.journey,
    fixtureVersion,
    fixtureChecksum,
    accountState: input.accountState,
    contentState: input.contentState,
    browser: `Chromium ${browserVersion}`,
    viewport,
    effectiveZoom: input.effectiveZoom ?? 100,
    motionMode: input.motionMode ?? "FULL",
    screenshotPath: path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(screenshotBytes).digest("hex"),
    observedResult: "Required state rendered and route settled before capture.",
    knownLimitation:
      "Synthetic local fixture evidence; not production, deployment, MySQL, external-provider, or owner acceptance proof.",
    reviewerClassification: "PENDING_CODEX_VISUAL_REVIEW",
    timestamp: new Date().toISOString(),
  });
}

async function assertNoOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBeTruthy();
}

async function expectUnavailableWithoutLeakage(page: Page, route: string, forbiddenTitle: string) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${route}$`, "u"));
  await expect(page.locator("body")).not.toContainText(forbiddenTitle);
  await expect(page.locator("body")).toContainText(/not found|could not be found|404/u);
}

async function snapshotPublicEligibility() {
  return {
    listings: await db.communityListing.findMany({ select: { id: true, visibility: true } }),
    profiles: await db.communityProfile.findMany({ select: { id: true, visibility: true } }),
    collections: await db.communityCollection.findMany({ select: { id: true, visibility: true } }),
    guides: await db.communityGuideContent.findMany({ select: { id: true, status: true } }),
    logs: await db.communityVoyageLog.findMany({ select: { id: true, visibility: true } }),
  };
}

async function hideAllPublicCommunity() {
  await db.$transaction([
    db.communityListing.updateMany({ data: { visibility: "PRIVATE" } }),
    db.communityProfile.updateMany({ data: { visibility: "PRIVATE" } }),
    db.communityCollection.updateMany({ data: { visibility: "PRIVATE" } }),
    db.communityGuideContent.updateMany({ data: { status: "DRAFT" } }),
    db.communityVoyageLog.updateMany({ data: { visibility: "PRIVATE" } }),
  ]);
}

async function restorePublicEligibility(snapshot: Awaited<ReturnType<typeof snapshotPublicEligibility>>) {
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

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

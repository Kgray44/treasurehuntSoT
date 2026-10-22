// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.public-community
import {
  test,
  expect,
  type Request as BrowserRequest,
  type Response as BrowserResponse,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantCommunityExperience } from "../../.agents/scripts/sextant-community-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

const districts = [
  ["Featured", "Featured at the Harbor", "The Lantern Coast"],
  ["Chronicles", "Chronicles", "Paper Stars at First Bell"],
  ["Artifacts", "Artifacts", "Signal Flag Worksheet"],
  ["Templates", "Templates", "Quiet Watch Template"],
  ["Maps", "Maps and location packs", "Fictional Crescent Map Pack"],
  ["Audio and reveals", "Audio and reveal assets", "Harbor Bell Audio Cues"],
  ["Creators", "Creators", "Captain Almanac"],
  ["Collections", "Collections", "Harbor Starter Charts"],
  ["Guides", "Guides and the Shipwright's Workshop", "Reading the Weathered Chart"],
  ["Voyage Logs", "Voyage Logs", "Fictional Lantern Voyage Log"],
] as const;

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      test("anonymous ordinary Harbor entry, public districts, real details, honest empty search and return", async ({
        page,
      }, info) => {
        const fixture = await seedSextantCommunityExperience();
        expect(await seedSextantCommunityExperience()).toEqual(fixture);
        const baseline = await db.taleSession.findUniqueOrThrow({
          where: { id: fixture.playerVoyageId },
          select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
        });
        const edition = await db.publishedTaleVersion.findUniqueOrThrow({
          where: { id: fixture.playerVersionId },
          select: { checksum: true, contentSnapshot: true },
        });
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (
          task: string,
          activate: () => Promise<unknown>,
          ready: () => Promise<unknown>,
        ) => {
          const started = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - started;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const heading = (name: string) => page.getByRole("heading", { level: 1, name, exact: true });
        const navigation = page.getByRole("navigation", { name: "Community Harbor districts", exact: true });
        const checkPublic = async () => {
          for (const slug of [...fixture.ineligibleSlugs, "private-curator-notes"])
            await expect(page.locator(`a[href$="/${slug}"]`)).toHaveCount(0);
          expect((await new AxeBuilder({ page }).include(".community-harbor").analyze()).violations).toEqual(
            [],
          );
        };
        const capture = async (name: string, target = page.getByRole("heading", { level: 1 })) => {
          // Make each actual task heading visible only after its readiness
          // measurement and accessibility assertions have completed.
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        await page.goto("/");
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await measure(
          "Ordinary Community entry",
          () =>
            page
              .getByRole("navigation", { name: "Global navigation", exact: true })
              .getByRole("link", { name: "Community Harbor", exact: true })
              .click(),
          () => expect(heading("Find your next bearing")).toBeVisible(),
        );
        await expect(
          page.getByRole("heading", { name: "Featured at the Harbor", exact: true }),
        ).toBeVisible();
        await checkPublic();
        await capture("community-harbor");
        for (const [label, title, card] of districts) {
          await measure(
            `${label} district`,
            () => navigation.getByRole("link", { name: label, exact: true }).click(),
            async () => {
              await expect(heading(title)).toBeVisible();
              await expect(page.getByRole("heading", { level: 3, name: card, exact: true })).toBeVisible();
            },
          );
          await checkPublic();
          await capture(`district-${label.toLowerCase().replaceAll(" ", "-")}`);
        }
        const details = [
          { district: "Chronicles", card: "The Lantern Coast", outcome: "Chronicle preview" },
          { district: "Artifacts", card: "Glass Beacon Model", outcome: "Install or remix unavailable" },
          { district: "Creators", card: "Captain Almanac", outcome: "Creator Profile" },
          { district: "Creators", card: "Maker Lumen", outcome: "No public work yet" },
          { district: "Collections", card: "Harbor Starter Charts", outcome: "2 eligible entries" },
          { district: "Collections", card: "Empty Chart Case", outcome: "This public collection is empty" },
          { district: "Guides", card: "Reading the Weathered Chart", outcome: "Practical guidance" },
          { district: "Voyage Logs", card: "Fictional Lantern Voyage Log", outcome: "Voyage Record" },
        ];
        for (const detail of details) {
          await navigation.getByRole("link", { name: detail.district, exact: true }).click();
          const card = page
            .locator("article.community-card")
            .filter({ has: page.getByRole("heading", { level: 3, name: detail.card, exact: true }) });
          await expect(card).toHaveCount(1);
          const detailLink = card
            .getByRole("heading", { level: 3 })
            .getByRole("link", { name: detail.card, exact: true });
          const observeGuide = async (phase: string) => {
            if (detail.district !== "Guides") return;
            // Only fixed synthetic public route metadata is emitted. Private
            // screenshots, page context and traces remain with the collector.
            const pathname = new URL(page.url()).pathname;
            console.log(
              "SEXTANT_GUIDE_NAVIGATION",
              JSON.stringify({
                phase,
                pathname: pathname.startsWith("/community") ? pathname : "OUTSIDE_COMMUNITY",
                expectedHeadingCount: await heading(detail.card).count(),
                layers: await page.locator("[data-route-layer]").evaluateAll((layers) =>
                  layers.slice(0, 4).map((layer) => ({
                    path: layer.getAttribute("data-route-layer"),
                    state: layer.getAttribute("data-route-state"),
                    interactive: layer.getAttribute("data-route-interactive"),
                    hidden: layer.getAttribute("aria-hidden"),
                  })),
                ),
              }),
            );
          };
          await observeGuide("before-click");
          const guidePath = "/community/guides/reading-the-weathered-chart";
          let guideRequests = 0,
            guideResponses = 0;
          const onGuideRequest = (request: BrowserRequest) => {
            if (new URL(request.url()).pathname !== guidePath || guideRequests++ >= 12) return;
            console.log(
              "SEXTANT_GUIDE_REQUEST",
              JSON.stringify({ count: guideRequests, navigation: request.isNavigationRequest() }),
            );
          };
          const onGuideResponse = (response: BrowserResponse) => {
            if (new URL(response.url()).pathname !== guidePath || guideResponses++ >= 12) return;
            console.log(
              "SEXTANT_GUIDE_RESPONSE",
              JSON.stringify({ count: guideResponses, status: response.status() }),
            );
          };
          if (detail.district === "Guides") {
            page.on("request", onGuideRequest);
            page.on("response", onGuideResponse);
            await detailLink
              .evaluate((expected, expectedPath) => {
                const owned = window as Window & {
                  __sextantPhase4GuideObserver?: { events: unknown[]; remove: () => void };
                };
                if (owned.__sextantPhase4GuideObserver) return;
                let count = 0;
                const events: unknown[] = [];
                const observe = (event: Event, phase: string) => {
                  if (count++ >= 12) return;
                  try {
                    const target = event.target instanceof Element ? event.target : null;
                    const anchor = target?.closest("a");
                    const href = anchor ? new URL(anchor.href).pathname : "";
                    const box = expected.getBoundingClientRect();
                    const layer = expected.closest("[data-route-layer]");
                    const cardBox = expected.closest("article.community-card")?.getBoundingClientRect();
                    const pseudo = getComputedStyle(expected, "::after");
                    const ancestry = [];
                    for (let node = target; node && ancestry.length < 4; node = node.parentElement)
                      ancestry.push({
                        tag: node.tagName,
                        class: node.getAttribute("class")?.slice(0, 120) ?? "",
                      });
                    events.push({
                      event: event.type,
                      phase,
                      trusted: event.isTrusted,
                      prevented: event.defaultPrevented,
                      targetTag: target?.tagName ?? "NONE",
                      ancestry,
                      originalAnchorInPath: event.composedPath().includes(expected),
                      point:
                        event instanceof MouseEvent
                          ? { x: Math.round(event.clientX), y: Math.round(event.clientY) }
                          : null,
                      anchor:
                        href === expectedPath
                          ? "EXPECTED_GUIDE"
                          : href === "/community/guides"
                            ? "CURRENT_GUIDES"
                            : href.startsWith("/community")
                              ? "OTHER_PUBLIC"
                              : "NONE",
                      pathname: location.pathname.startsWith("/community")
                        ? location.pathname
                        : "OUTSIDE_COMMUNITY",
                      scrollY: Math.round(scrollY),
                      scrollRoot: Math.round(document.scrollingElement?.scrollTop ?? 0),
                      viewport: {
                        width: innerWidth,
                        height: innerHeight,
                        offsetTop: visualViewport?.offsetTop,
                        offsetLeft: visualViewport?.offsetLeft,
                      },
                      cardRect: cardBox
                        ? {
                            x: Math.round(cardBox.x),
                            y: Math.round(cardBox.y),
                            width: Math.round(cardBox.width),
                            height: Math.round(cardBox.height),
                          }
                        : null,
                      pseudo: {
                        position: pseudo.position,
                        top: pseudo.top,
                        right: pseudo.right,
                        bottom: pseudo.bottom,
                        left: pseudo.left,
                        pointerEvents: pseudo.pointerEvents,
                      },
                      matchingAnchors: [
                        ...document.querySelectorAll<HTMLAnchorElement>(`a[href="${expectedPath}"]`),
                      ]
                        .slice(0, 4)
                        .map((link) => {
                          const rect = link.getBoundingClientRect(),
                            route = link.closest("[data-route-layer]");
                          return {
                            original: link === expected,
                            connected: link.isConnected,
                            inactive: Boolean(link.closest('[inert], [aria-hidden="true"]')),
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            generation: route?.getAttribute("data-route-generation"),
                            role: route?.getAttribute("data-route-role"),
                          };
                        }),
                      expectedRect: box
                        ? {
                            x: Math.round(box.x),
                            y: Math.round(box.y),
                            width: Math.round(box.width),
                            height: Math.round(box.height),
                          }
                        : null,
                      expectedConnected: Boolean(expected?.isConnected),
                      expectedInactive: Boolean(expected?.closest('[inert], [aria-hidden="true"]')),
                      routeRole: layer?.getAttribute("data-route-role"),
                      generation: layer?.getAttribute("data-route-generation"),
                      transition: document
                        .querySelector(".product-route-transition")
                        ?.getAttribute("data-route-state"),
                    });
                  } catch {
                    /* Observation never controls the action or primary error. */
                  }
                };
                const capture = (event: Event) => observe(event, "capture");
                const bubble = (event: Event) => observe(event, "bubble");
                for (const type of ["pointerdown", "pointerup", "click"]) {
                  document.addEventListener(type, capture, { capture: true, passive: true });
                  document.addEventListener(type, bubble, { passive: true });
                }
                owned.__sextantPhase4GuideObserver = {
                  events,
                  remove: () => {
                    for (const type of ["pointerdown", "pointerup", "click"]) {
                      document.removeEventListener(type, capture, true);
                      document.removeEventListener(type, bubble);
                    }
                    delete owned.__sextantPhase4GuideObserver;
                  },
                };
              }, guidePath)
              .catch(() => console.warn("SEXTANT_GUIDE_POINTER_OBSERVATION_UNAVAILABLE"));
          }
          try {
            await measure(
              `${detail.card} detail`,
              () => detailLink.click(),
              async () => {
                await expect(heading(detail.card)).toBeVisible();
                await expect(page.getByRole("heading", { name: detail.outcome, exact: true })).toBeVisible();
              },
            );
          } catch (error) {
            await observeGuide("failed").catch(() =>
              console.warn("SEXTANT_GUIDE_FAILURE_OBSERVATION_UNAVAILABLE"),
            );
            throw error;
          } finally {
            if (detail.district === "Guides") {
              page.off("request", onGuideRequest);
              page.off("response", onGuideResponse);
              console.log(
                "SEXTANT_GUIDE_NETWORK_SUMMARY",
                JSON.stringify({ requests: guideRequests, responses: guideResponses }),
              );
              await page
                .evaluate(() => {
                  const observer = (
                    window as Window & {
                      __sextantPhase4GuideObserver?: { events: unknown[]; remove: () => void };
                    }
                  ).__sextantPhase4GuideObserver;
                  const events = observer?.events ?? [];
                  observer?.remove();
                  return events;
                })
                .then((events) => console.log("SEXTANT_GUIDE_POINTER_SUMMARY", JSON.stringify(events)))
                .catch(() => console.warn("SEXTANT_GUIDE_POINTER_CLEANUP_UNAVAILABLE"));
            }
          }
          await observeGuide("ready");
          if (detail.card === "The Lantern Coast") {
            const comments = page.getByRole("region", { name: "Comments", exact: true });
            await expect(comments).toContainText("No public comments yet.");
            await expect(
              comments.getByRole("link", { name: "Sign in to comment", exact: true }),
            ).toBeVisible();
            await expect(comments.getByRole("textbox")).toHaveCount(0);
          }
          await checkPublic();
          await capture(`detail-${detail.card.toLowerCase().replaceAll(" ", "-")}`);
          await capture(
            `outcome-${detail.card.toLowerCase().replaceAll(" ", "-")}`,
            page.getByRole("heading", { name: detail.outcome, exact: true }),
          );
          if (detail.card === "The Lantern Coast") {
            const comments = page.getByRole("region", { name: "Comments", exact: true });
            await capture(
              "community-anonymous-comment-gate",
              comments.getByRole("link", { name: "Sign in to comment", exact: true }),
            );
          }
          await measure(
            `${detail.card} return`,
            () => navigation.getByRole("link", { name: "Community Harbor", exact: true }).click(),
            () => expect(heading("Find your next bearing")).toBeVisible(),
          );
        }
        const search = page.getByRole("searchbox", { name: "Search public Community Harbor", exact: true });
        await search.fill("sextant-no-public-chart-20261019");
        await measure(
          "Actual empty public search",
          () => page.getByRole("button", { name: "Search Community Harbor", exact: true }).click(),
          () =>
            expect(
              page.getByRole("heading", { name: "No public charts match these criteria", exact: true }),
            ).toBeVisible(),
        );
        await checkPublic();
        await search.scrollIntoViewIfNeeded();
        const searchButton = page.getByRole("button", { name: "Search Community Harbor", exact: true });
        await measure(
          "Settled readable Search hover",
          () => searchButton.hover(),
          async () => {
            await expect(searchButton).toHaveCSS("background-color", "rgb(226, 203, 145)");
            await expect(searchButton).toHaveCSS("background-image", "none");
          },
        );
        const hoverContrast = await searchButton.evaluate((element) => {
          const style = getComputedStyle(element);
          const luminance = (css: string) => {
            const channels = css
              .match(/[\d.]+/g)
              ?.slice(0, 3)
              .map(Number);
            if (channels?.length !== 3) throw new Error("SEXTANT_SEARCH_COLOR_UNAVAILABLE");
            return channels
              .map((channel) => {
                const value = channel / 255;
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          };
          const foreground = luminance(style.color),
            background = luminance(style.backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        expect(hoverContrast, "Hovered Search glyph stays readable").toBeGreaterThanOrEqual(4.5);
        await page.screenshot({ path: info.outputPath("community-empty-search.png") });
        // There are two legitimate clear controls (active chips and empty state).
        const empty = page.locator(".community-state--empty");
        await capture("community-empty-search-result", empty.getByRole("heading"));
        await empty.getByRole("button", { name: "Clear search and filters", exact: true }).click();
        await expect(search).toHaveValue("");
        await expect(
          page.getByRole("heading", { name: "No public charts match these criteria", exact: true }),
        ).toHaveCount(0);
        await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
        await expect(page).toHaveURL(/\/$/u);
        await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.playerVoyageId },
            select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findUniqueOrThrow({
            where: { id: fixture.playerVersionId },
            select: { checksum: true, contentSnapshot: true },
          }),
        ).toEqual(edition);
        await writeFile(
          info.outputPath("community-journey-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-community-journeys.spec.ts",
                ".agents/scripts/sextant-community-fixture.ts",
                ".agents/scripts/sextant-chronicle-choice.ts",
                "scripts/homeport/seed-phase4-fixture.mjs",
              ]),
              fixture,
              viewport,
              reducedMotion,
              feedback,
              anonymous: true,
              ordinaryEntryAndReturn: true,
              publicDistricts: districts.length,
              publicDetails: details.length,
              actualEmptySearch: true,
              hiddenLinksAbsent: true,
              unchangedCanonicalProgress: true,
              unchangedPublishedEdition: true,
              protectedQualification: false,
              physicalEvidence: false,
            },
            null,
            2,
          ),
        );
      });
    });
  }
}

import type { Page } from "@playwright/test";
import {
  capturePhase3DbTruth,
  expect,
  installCanonicalPhase3PlayerSession,
  phase3Test as test,
  readPreseededPhase3BaseFixture,
  setPhase3Motion,
} from "./fixtures/lanternwake-phase3";

async function preserveReadOnlyJournalState(page: Page) {
  const unsafeRequests: string[] = [];
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/") && method !== "GET" && method !== "HEAD")
      unsafeRequests.push(`${method} ${pathname}`);
  });
  await page.route("**/api/player/playthroughs/*/journal-state", async (route) => {
    if (route.request().method().toUpperCase() !== "POST") return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return () => {
    expect(
      unsafeRequests.filter((request) => !/^POST \/api\/player\/playthroughs\/[^/]+\/journal-state$/u.test(request)),
      "The canonical journal journey may persist only through its locally intercepted reading-state boundary.",
    ).toEqual([]);
  };
}

test("proves the canonical read-only journal journey across current product routes", async ({
  page,
  browserName,
}, testInfo) => {
  // Chromium completes this route in seconds; a minute keeps the mobile
  // contract responsive while yielding an actionable failing step if it regresses.
  test.setTimeout(60_000);
  expect(process.env.FOREVER_VALIDATION_ISOLATION).toBe("1");
  const fixture = readPreseededPhase3BaseFixture();
  const before = await capturePhase3DbTruth(fixture);
  const verifyRequests = await preserveReadOnlyJournalState(page);
  try {
    const mobile = browserName === "webkit";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await setPhase3Motion(
      page,
      mobile
        ? { id: "M4", productMode: "full", browserReduced: true, resolvedMode: "reduced" }
        : { id: "M1", productMode: "full", browserReduced: false, resolvedMode: "full" },
    );
    await installCanonicalPhase3PlayerSession(page, fixture, testInfo.project.use.baseURL as string);
    await page.goto(`${fixture.path}?section=journal`);
    await expect(page).toHaveURL(/\/play\/[^/]+\/session\/[^/?#]+/u);
    const journal = page.locator(".chronicle-journal-shell");
    await expect(journal).toHaveAttribute("data-journal-phase", "ENTRY_IDLE");
    await page.getByRole("button", { name: "Open the journal" }).click();
    const skipCeremony = page.getByRole("button", { name: "Skip ceremony" });
    await expect(skipCeremony).toBeVisible();
    // Reduced-motion WebKit correctly settles the ceremony itself and removes
    // the now-unneeded control; the full-motion path must prove explicit skip.
    if (!mobile) await skipCeremony.click();
    await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY", { timeout: 20_000 });
    await expect(journal).toHaveAttribute("data-page-flip-readiness", /^(ready|fallback|reduced)$/u);
    await expect(journal.getByRole("heading", { name: /Voyage Journal$/u })).toBeVisible();
    await expect(page.locator(".main-journal-book")).toBeVisible();
    await expect(journal.getByRole("button", { name: /^Motion:/u })).toBeVisible();
    await expect(journal.getByRole("navigation", { name: "Journal tools" })).toBeVisible();
    await journal.getByRole("button", { name: "chapters" }).click();
    const drawer = page.locator(".journal-chapters-drawer");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(drawer.getByRole("heading", { name: "Released chapters" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close chapter drawer" }).click();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
  } finally {
    verifyRequests();
    expect(await capturePhase3DbTruth(fixture)).toEqual(before);
  }
});

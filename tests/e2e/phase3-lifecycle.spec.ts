import { ensurePhase3JournalReady, expect, openPhase3Player, phase3Test as test } from "./fixtures/lanternwake-phase3";

test.describe("Project Lanternwake canonical Chronicle journal lifecycle", () => {
  test("keeps the published Chronicle journal, PageFlip boundary, and motion setting bounded across reentry", async ({
    page,
    phase3,
  }) => {
    test.setTimeout(120_000);
    let lastRequest = "none";
    let lastConsole = "none";
    page.on("request", (request) => {
      lastRequest = `${request.method()} ${new URL(request.url()).pathname}`;
    });
    page.on("console", (message) => {
      lastConsole = `${message.type()}: ${message.text()}`;
    });
    const checkpoint = async (name: string) => {
      console.log(`[lanternwake-lifecycle] ${name}; request=${lastRequest}; console=${lastConsole}`);
      await page.evaluate((label) => console.info(`[lanternwake-lifecycle] ${label}`), name);
    };

    await checkpoint("fixture-create");
    const fixture = await phase3.createCase("P3-CANONICAL-JOURNAL-LIFECYCLE", "CHAPTER_RELEASED");
    await openPhase3Player(page, fixture, "journal");
    await checkpoint("journal-ready");

    const shell = page.locator(".voyage-shell").last();
    const book = page.locator(".main-journal-book");
    const expectBoundedBook = async () => {
      await expect(book).toHaveCount(1);
      const status = await book.getAttribute("data-pageflip-status");
      if (status === "fallback") {
        await expect(book).toHaveAttribute("data-pageflip-fallback-reason", "Journal opening skipped");
        await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
      } else {
        await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      }
      await expect(book.locator('[data-pageflip-lifecycle="stale"]')).toHaveCount(0);
    };
    await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    await expectBoundedBook();
    await checkpoint("pageflip-ready");

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.reload();
      await checkpoint(`reload-${cycle + 1}`);
      await ensurePhase3JournalReady(page);
      await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
      await expectBoundedBook();
      await checkpoint(`reentry-${cycle + 1}`);
    }

    await page.getByRole("button", { name: "Motion: full" }).click();
    await expect(shell).toHaveAttribute("data-motion-mode", "gentle");
    await page.getByRole("button", { name: "Motion: gentle" }).click();
    await expect(shell).toHaveAttribute("data-motion-mode", "reduced");
    await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
    await expect.poll(() => book.getAttribute("data-pageflip-status")).toMatch(/^(fallback|reduced)$/u);
    await checkpoint("reduced-ready");
  });
});

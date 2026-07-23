import { ensurePhase3JournalReady, expect, openPhase3Player, phase3Test as test } from "./fixtures/lanternwake-phase3";

test.describe("Project Lanternwake canonical Chronicle journal lifecycle", () => {
  test("keeps the published Chronicle journal, PageFlip boundary, and motion setting bounded across reentry", async ({
    page,
    phase3,
  }) => {
    test.setTimeout(180_000);
    const fixture = await phase3.createCase("P3-CANONICAL-JOURNAL-LIFECYCLE", "CHAPTER_RELEASED");
    await openPhase3Player(page, fixture, "journal");

    const shell = page.locator(".voyage-shell").last();
    const book = page.locator(".main-journal-book");
    await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    await expect(book).toHaveCount(1);
    await expect(book).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.reload();
      await ensurePhase3JournalReady(page);
      await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
      await expect(book).toHaveCount(1);
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await expect(book.locator('[data-pageflip-lifecycle="stale"]')).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Motion: full" }).click();
    await expect(shell).toHaveAttribute("data-motion-mode", "gentle");
    await page.getByRole("button", { name: "Motion: gentle" }).click();
    await expect(shell).toHaveAttribute("data-motion-mode", "reduced");
    await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
    await expect(book).toHaveAttribute("data-pageflip-status", "reduced");
  });
});

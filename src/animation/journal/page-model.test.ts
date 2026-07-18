import { describe, expect, it } from "vitest";
import type { PublicSnapshot } from "@/domain/story";
import { buildJournalPages, pageIndexForChapter } from "./page-model";

const base = {
  campaign: { slug: "safe-development", title: "Safe Development Voyage", status: "ACTIVE" },
  chapters: [
    {
      ordinal: 1,
      state: "ACTIVE",
      title: "The Lantern Test",
      narrative: "Released safe prose.",
      objective: "Confirm the mark.",
      riddle: "A safe riddle.",
    },
    { ordinal: 2, state: "LOCKED", teaser: "A later public-safe horizon." },
  ],
} satisfies Pick<PublicSnapshot, "campaign" | "chapters">;

describe("journal page model", () => {
  it("creates covers, endpapers, physical chapter leaves, and back matter", () => {
    const pages = buildJournalPages(base);
    expect(pages.map((page) => page.kind)).toEqual(
      expect.arrayContaining([
        "cover",
        "endpaper",
        "title",
        "dedication",
        "chapter-divider",
        "narrative",
        "objective-riddle",
        "locked",
        "back-matter",
      ]),
    );
    expect(pages.length % 2).toBe(0);
  });

  it("never carries partially present unreleased fields into a locked page", () => {
    const pages = buildJournalPages({
      ...base,
      chapters: [{ ordinal: 3, state: "LOCKED", narrative: "SECRET-NARRATIVE", objective: "SECRET-OBJECTIVE" }],
    });
    expect(JSON.stringify(pages)).not.toContain("SECRET");
    expect(pages.find((page) => page.kind === "locked")?.title).toBe("Awaiting the captain's signal");
  });

  it("uses stable identifiers across safe snapshot updates", () => {
    const before = buildJournalPages(base).map((page) => page.id);
    const after = buildJournalPages({ ...base, campaign: { ...base.campaign, status: "PAUSED" } }).map(
      (page) => page.id,
    );
    expect(after).toEqual(before);
  });

  it("maps direct chapter navigation to its physical divider", () => {
    const pages = buildJournalPages(base);
    expect(pages[pageIndexForChapter(pages, 2)]).toMatchObject({ id: "chapter-2-divider", chapterOrdinal: 2 });
  });
});

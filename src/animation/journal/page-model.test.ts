import { describe, expect, it } from "vitest";
import type { PublicSnapshot } from "@/domain/story";
import { buildJournalPages, pageIndexForAnnotation, pageIndexForChapter } from "./page-model";

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

  it("keeps annotation page, ink identity, and unseen state stable across snapshot updates", () => {
    const annotation = {
      key: "captains-mark",
      title: "Captain's margin",
      body: "Fresh safe ink.",
      createdAt: "2026-07-18T20:00:00.000Z",
      unseen: true,
    };
    const withAnnotation = {
      ...base,
      chapters: [
        {
          ...base.chapters[0],
          annotations: [annotation],
        },
        base.chapters[1],
      ],
    } satisfies Pick<PublicSnapshot, "campaign" | "chapters">;
    const before = buildJournalPages(withAnnotation);
    const index = pageIndexForAnnotation(before, "captains-mark");
    expect(before[index]).toMatchObject({
      id: "chapter-1-annotation-captains-mark",
      kind: "annotation",
      chapterOrdinal: 1,
      annotationKey: "captains-mark",
      unseen: true,
      body: "Fresh safe ink.",
      note: "Jul 18, 2026",
    });

    const after = buildJournalPages({
      ...withAnnotation,
      chapters: [
        {
          ...withAnnotation.chapters[0],
          annotations: [{ ...annotation, unseen: false }],
        },
        withAnnotation.chapters[1],
      ],
    });
    expect(after[pageIndexForAnnotation(after, "captains-mark")]).toMatchObject({
      id: before[index]!.id,
      annotationKey: "captains-mark",
      unseen: false,
    });
  });

  it("returns no annotation index for a different annotation identity", () => {
    expect(pageIndexForAnnotation(buildJournalPages(base), "not-present")).toBe(-1);
  });

  it("formats annotation dates with the fixed product locale and UTC day across SSR and client machines", () => {
    const pages = buildJournalPages({
      ...base,
      chapters: [
        {
          ...base.chapters[0],
          annotations: [
            {
              key: "timezone-mark",
              title: "A late local mark",
              body: "The recorded day follows the shared voyage clock.",
              createdAt: "2026-07-18T23:30:00-07:00",
              unseen: false,
            },
          ],
        },
        base.chapters[1],
      ],
    });

    expect(pages[pageIndexForAnnotation(pages, "timezone-mark")]).toMatchObject({
      note: "Jul 19, 2026",
    });
  });

  it("can disambiguate annotation identity by chapter ordinal", () => {
    const pages = buildJournalPages({
      ...base,
      chapters: [
        {
          ...base.chapters[0],
          annotations: [
            {
              key: "shared-mark",
              title: "First mark",
              body: "First safe ink.",
              createdAt: "2026-07-18T20:00:00.000Z",
              unseen: true,
            },
          ],
        },
        {
          ordinal: 2,
          state: "ACTIVE",
          title: "Second chapter",
          narrative: "Second safe prose.",
          objective: "Confirm the second mark.",
          annotations: [
            {
              key: "shared-mark",
              title: "Second mark",
              body: "Second safe ink.",
              createdAt: "2026-07-18T21:00:00.000Z",
              unseen: false,
            },
          ],
        },
      ],
    });
    expect(pages[pageIndexForAnnotation(pages, "shared-mark", 2)]).toMatchObject({
      id: "chapter-2-annotation-shared-mark",
      chapterOrdinal: 2,
      body: "Second safe ink.",
    });
  });
});

import type { PublicChapter, PublicSnapshot } from "@/domain/story";

export type JournalPageKind =
  | "cover"
  | "endpaper"
  | "title"
  | "dedication"
  | "chapter-divider"
  | "narrative"
  | "objective-riddle"
  | "hint"
  | "annotation"
  | "related"
  | "locked"
  | "back-matter";

export type JournalPage = {
  id: string;
  kind: JournalPageKind;
  density: "hard" | "soft";
  chapterOrdinal?: number;
  annotationKey?: string;
  unseen?: boolean;
  folio?: number;
  title?: string;
  eyebrow?: string;
  body?: string;
  objective?: string;
  riddle?: string;
  note?: string;
  state?: string;
};

const annotationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatAnnotationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid Date" : annotationDateFormatter.format(date);
}

function chapterPages(chapter: PublicChapter, folio: number): JournalPage[] {
  const safeTitle = chapter.title ?? chapter.teaser ?? `Chapter ${chapter.ordinal}`;
  const pages: JournalPage[] = [
    {
      id: `chapter-${chapter.ordinal}-divider`,
      kind: "chapter-divider",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio,
      eyebrow: `Chapter ${chapter.ordinal}`,
      title: safeTitle,
      state: chapter.state,
      note: chapter.teaser,
    },
  ];
  if (!chapter.title || !chapter.narrative || !chapter.objective) {
    pages.push({
      id: `chapter-${chapter.ordinal}-locked`,
      kind: "locked",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio: folio + 1,
      eyebrow: "Sealed leaf",
      title: "Awaiting the captain's signal",
      body: "No unreleased words have crossed the tide. The page holds only its public seal.",
      state: chapter.state,
    });
    return pages;
  }
  pages.push(
    {
      id: `chapter-${chapter.ordinal}-narrative`,
      kind: "narrative",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio: folio + 1,
      eyebrow: `Chapter ${chapter.ordinal}`,
      title: chapter.title,
      body: chapter.narrative,
      state: chapter.state,
    },
    {
      id: `chapter-${chapter.ordinal}-course`,
      kind: "objective-riddle",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio: folio + 2,
      eyebrow: "Present course",
      objective: chapter.objective,
      riddle: chapter.riddle,
      state: chapter.state,
    },
  );
  chapter.hints?.forEach((hint) =>
    pages.push({
      id: `chapter-${chapter.ordinal}-hint-${hint.ordinal}`,
      kind: "hint",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio: folio + pages.length,
      eyebrow: `Released bearing ${hint.ordinal}`,
      title: "A note in the margin",
      body: hint.body,
    }),
  );
  chapter.annotations?.forEach((annotation) =>
    pages.push({
      id: `chapter-${chapter.ordinal}-annotation-${annotation.key}`,
      kind: "annotation",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      annotationKey: annotation.key,
      unseen: annotation.unseen,
      folio: folio + pages.length,
      eyebrow: annotation.title,
      body: annotation.body,
      note: formatAnnotationDate(annotation.createdAt),
    }),
  );
  if (chapter.related && Object.values(chapter.related).some(Boolean)) {
    pages.push({
      id: `chapter-${chapter.ordinal}-related`,
      kind: "related",
      density: "soft",
      chapterOrdinal: chapter.ordinal,
      folio: folio + pages.length,
      eyebrow: "Cross-reference",
      title: "Marks elsewhere in the workspace",
      body: "Released chart, relic, or optional-ledger details connected to this chapter remain available in their own physical sections.",
    });
  }
  return pages;
}

export function buildJournalPages(snapshot: Pick<PublicSnapshot, "campaign" | "chapters">): JournalPage[] {
  const pages: JournalPage[] = [
    { id: "front-cover", kind: "cover", density: "hard", title: snapshot.campaign.title, eyebrow: "Voyage journal" },
    {
      id: "front-endpaper",
      kind: "endpaper",
      density: "hard",
      title: "A chart of paired stars",
      note: "This public development copy carries no private final course.",
    },
    {
      id: "title-page",
      kind: "title",
      density: "soft",
      folio: 1,
      title: snapshot.campaign.title,
      eyebrow: "The Forever Treasure",
      body: "A record of moonlit bearings, recovered curiosities, and promises kept at sea.",
    },
    {
      id: "dedication",
      kind: "dedication",
      density: "soft",
      folio: 2,
      title: "For the invited sailor",
      body: "May every safe harbor leave room for another horizon. Generic development inscription.",
    },
  ];
  let folio = 3;
  snapshot.chapters.forEach((chapter) => {
    const built = chapterPages(chapter, folio);
    pages.push(...built);
    folio += built.length;
  });
  pages.push({
    id: "back-matter",
    kind: "back-matter",
    density: "soft",
    folio,
    title: "The unwritten sea",
    body: "Later leaves remain physically present but contain no unreleased content.",
  });
  if (pages.length % 2 !== 0)
    pages.push({ id: "back-endpaper", kind: "endpaper", density: "hard", title: "Return by moonlight" });
  return pages;
}

export function pageIndexForChapter(pages: JournalPage[], ordinal: number) {
  return Math.max(
    0,
    pages.findIndex((page) => page.chapterOrdinal === ordinal),
  );
}

export function pageIndexForAnnotation(pages: JournalPage[], annotationKey: string, chapterOrdinal?: number) {
  return pages.findIndex(
    (page) =>
      page.annotationKey === annotationKey && (chapterOrdinal === undefined || page.chapterOrdinal === chapterOrdinal),
  );
}

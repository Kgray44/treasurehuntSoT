import type { PlayerJournalBlock, PlayerJournalProjection } from "@/chronicle/journal-contract";

export type ChronicleJournalPageKind = "title" | "edition" | "chapter" | "block" | "endpaper";
export type ChronicleJournalPagePart = "primary" | "secondary";

export type ChronicleJournalPage = {
  id: string;
  kind: ChronicleJournalPageKind;
  density: "soft";
  label: string;
  folio: number;
  chapterId?: string;
  blockId?: string;
  block?: PlayerJournalBlock;
  part?: ChronicleJournalPagePart;
  title?: string;
  body?: string;
};

export type JournalTaleIdentity = {
  title: string;
  subtitle: string | null;
  versionLabel: string;
  publishedAt: string | null;
  completedAt: string | null;
};

export function buildChronicleJournalPages(
  journal: PlayerJournalProjection,
  tale: JournalTaleIdentity,
): ChronicleJournalPage[] {
  const pages: ChronicleJournalPage[] = [
    {
      id: "journal-title",
      kind: "title",
      density: "soft",
      label: `${tale.title} title page`,
      folio: 1,
      title: tale.title,
      body: tale.subtitle ?? "A Chronicle preserved in this journal.",
    },
    {
      id: "journal-edition",
      kind: "edition",
      density: "soft",
      label: `Edition ${tale.versionLabel}`,
      folio: 2,
      title: journal.mode === "historical" ? "Preserved voyage" : "The living edition",
      body:
        journal.mode === "historical"
          ? `Completed ${formatDate(tale.completedAt)}. This volume remains bound to edition ${tale.versionLabel}.`
          : `Edition ${tale.versionLabel}${tale.publishedAt ? `, published ${formatDate(tale.publishedAt)}` : ""}.`,
    },
  ];

  for (const chapter of journal.chapters) {
    pages.push({
      id: `chapter:${chapter.id}`,
      kind: "chapter",
      density: "soft",
      label: `Chapter ${chapter.orderIndex + 1}: ${chapter.title}`,
      folio: pages.length + 1,
      chapterId: chapter.id,
      title: chapter.title,
      body: chapter.subtitle ?? "A new leaf in the voyage.",
    });
    for (const block of chapter.blocks) {
      pages.push(blockPage(block, "primary", pages.length + 1));
      if (block.presentation.spreadMode === "two-page") pages.push(blockPage(block, "secondary", pages.length + 1));
    }
  }

  pages.push({
    id: "journal-endpaper",
    kind: "endpaper",
    density: "soft",
    label: journal.mode === "historical" ? "Completed journal endpaper" : "Unwritten journal endpaper",
    folio: pages.length + 1,
    title: journal.mode === "historical" ? "The voyage is preserved" : "The unwritten sea",
    body:
      journal.mode === "historical"
        ? "Every released page remains exactly as this crew encountered it."
        : "New leaves remain sealed until the shared session releases them.",
  });
  if (pages.length % 2 !== 0)
    pages.push({
      id: "journal-back-leaf",
      kind: "endpaper",
      density: "soft",
      label: "Back journal leaf",
      folio: pages.length + 1,
      title: "Return by moonlight",
      body: "The binding remembers your place.",
    });
  return pages;
}

function blockPage(block: PlayerJournalBlock, part: ChronicleJournalPagePart, folio: number): ChronicleJournalPage {
  return {
    id: `block:${block.id}:${part}`,
    kind: "block",
    density: "soft",
    label: `${block.title}${part === "secondary" ? ", continued" : ""}`,
    folio,
    chapterId: block.chapterId,
    blockId: block.id,
    block,
    part,
  };
}

function formatDate(value: string | null) {
  if (!value) return "on an unrecorded date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function pageIndexForJournalBlock(pages: ChronicleJournalPage[], blockId: string | null) {
  if (!blockId) return 0;
  const index = pages.findIndex((page) => page.blockId === blockId && page.part !== "secondary");
  return index < 0 ? 0 : index;
}

export function pageIndexForJournalChapter(pages: ChronicleJournalPage[], chapterId: string) {
  const index = pages.findIndex((page) => page.chapterId === chapterId);
  return index < 0 ? 0 : index;
}

export function pageIndexForReadingState(
  pages: ChronicleJournalPage[],
  pageId: string | null,
  currentBlockId: string | null,
) {
  const restored = pageId ? pages.findIndex((page) => page.id === pageId) : -1;
  return restored >= 0 ? restored : pageIndexForJournalBlock(pages, currentBlockId);
}

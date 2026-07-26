import type { Metadata } from "next";

export type HarborShareableKind = "listing" | "creator" | "collection" | "guide" | "voyage-log";
export type HarborShareVisibility = "PRIVATE" | "CREW_ONLY" | "UNLISTED" | "COMMUNITY";

function safeText(value: string | undefined, maximum: number) {
  const normalized = value
    ?.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, "")
    .trim();
  return normalized?.slice(0, maximum);
}

/** Builds only canonical, public-safe fields; callers cannot accidentally pass private records through. */
export function harborSharingMetadata(input: {
  kind: HarborShareableKind;
  visibility: HarborShareVisibility;
  canonicalPath: string;
  title?: string;
  safeDescription?: string;
}): Metadata {
  if (input.visibility === "PRIVATE" || input.visibility === "CREW_ONLY")
    return { robots: { index: false, follow: false, nocache: true }, title: "Not found" };
  if (input.visibility === "UNLISTED")
    return {
      // Exact-link content is deliberately absent from every crawler cache as
      // well as from discovery. Use the explicit directive because Next's
      // `nocache` shorthand is not an equivalent noarchive instruction.
      robots: "noindex, nofollow, noarchive",
      title: safeText(input.title, 140) ?? "Unlisted Community Harbor entry",
    };
  const title = safeText(input.title, 140) ?? "Community Harbor";
  const description = safeText(input.safeDescription, 280);
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: input.canonicalPath },
    openGraph: { type: "article", title, ...(description ? { description } : {}), url: input.canonicalPath },
  };
}

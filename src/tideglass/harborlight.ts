import { buildTideglassCompareHref } from "./passage";

type HarborlightEditionSource = Readonly<{
  id: string;
  tale: Readonly<{
    id: string;
    slug: string;
    status: string;
    visibility: string;
  }>;
}>;

export type HarborlightTideglassRelease = Readonly<{
  semanticVersion: string;
  sourcePublishedTaleVersion: HarborlightEditionSource | null;
}>;

export type HarborlightTideglassComparison = Readonly<{
  href: string;
  sourceReleaseVersion: string;
  targetReleaseVersion: string;
}>;

function isPublicPublishedChronicle(source: HarborlightEditionSource | null): source is HarborlightEditionSource {
  return Boolean(source && source.tale.status === "PUBLISHED" && source.tale.visibility === "PUBLIC");
}

/**
 * Community Harbor owns release selection. Tideglass only accepts the exact source-edition
 * pair when both releases belong to one public Chronicle; it never compares package manifests.
 */
export function resolveHarborlightTideglassComparison(input: {
  listingItemType: string;
  currentRelease: HarborlightTideglassRelease | null;
  earlierReleases: readonly HarborlightTideglassRelease[];
  returnTo: string;
}): HarborlightTideglassComparison | null {
  const currentRelease = input.currentRelease;
  const target = currentRelease?.sourcePublishedTaleVersion ?? null;
  if (input.listingItemType !== "CHRONICLE" || !currentRelease || !isPublicPublishedChronicle(target)) {
    return null;
  }

  const sourceRelease = input.earlierReleases.find((release) => {
    const source = release.sourcePublishedTaleVersion;
    return (
      isPublicPublishedChronicle(source) &&
      source.id !== target.id &&
      source.tale.id === target.tale.id &&
      source.tale.slug === target.tale.slug
    );
  });
  const source = sourceRelease?.sourcePublishedTaleVersion;
  if (!source || !sourceRelease) return null;

  return {
    href: buildTideglassCompareHref({
      taleSlug: target.tale.slug,
      sourceEditionId: source.id,
      targetEditionId: target.id,
      returnTo: input.returnTo,
    }),
    sourceReleaseVersion: sourceRelease.semanticVersion,
    targetReleaseVersion: currentRelease.semanticVersion,
  };
}

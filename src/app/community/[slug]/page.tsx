import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListingBySlug } from "@/community/services";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { CommunityReviewList } from "@/components/community/CommunityReviewList";
import { CommunitySocialControls } from "@/components/community/CommunitySocialControls";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublicListingBySlug((await params).slug);
  if (!listing) return harborSharingMetadata({ kind: "listing", visibility: "PRIVATE", canonicalPath: "/community" });
  return harborSharingMetadata({
    kind: "listing",
    visibility: "COMMUNITY",
    canonicalPath: `/community/${encodeURIComponent(listing.slug)}`,
    title: listing.title,
    safeDescription: listing.shortDescription ?? undefined,
  });
}

export default async function CommunityListingPage({ params }: Props) {
  const listing = await getPublicListingBySlug((await params).slug);
  if (!listing) notFound();
  return (
    <main className="page-shell" aria-labelledby="community-listing-title">
      <p>
        <Link href="/community">Back to Community Harbor</Link>
      </p>
      <p className="eyebrow">{listing.itemType}</p>
      <h1 id="community-listing-title">{listing.title}</h1>
      {listing.shortDescription ? <p>{listing.shortDescription}</p> : null}
      <p>Created by {listing.creator.displayName}</p>
      {listing.tags.length ? <p aria-label="Tags">{listing.tags.join(", ")}</p> : null}
      {listing.spoilerLevel !== "NONE" ? <p>Preview-safe details only.</p> : null}
      <CommunitySocialControls creatorProfileId={listing.creator.id} subjectType="LISTING" subjectId={listing.id} />
      <CommunityReviewList listingId={listing.id} />
    </main>
  );
}

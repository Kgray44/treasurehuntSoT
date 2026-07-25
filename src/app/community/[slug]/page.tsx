import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListingBySlug } from "@/community/services";
import { CommunityReviewList } from "@/components/community/CommunityReviewList";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublicListingBySlug((await params).slug);
  if (!listing) return { title: "Community listing unavailable", robots: { index: false, follow: false } };
  return {
    title: listing.title,
    description: listing.shortDescription ?? "A public Community Harbor listing.",
    openGraph: { title: listing.title, description: listing.shortDescription ?? "A public Community Harbor listing." },
  };
}

export default async function CommunityListingPage({ params }: Props) {
  const listing = await getPublicListingBySlug((await params).slug);
  if (!listing) notFound();
  return (
    <main className="page-shell" aria-labelledby="community-listing-title">
      <p><Link href="/community">Back to Community Harbor</Link></p>
      <p className="eyebrow">{listing.itemType}</p>
      <h1 id="community-listing-title">{listing.title}</h1>
      {listing.shortDescription ? <p>{listing.shortDescription}</p> : null}
      <p>Created by {listing.creator.displayName}</p>
      {listing.tags.length ? <p aria-label="Tags">{listing.tags.join(", ")}</p> : null}
      {listing.spoilerLevel !== "NONE" ? <p>Preview-safe details only.</p> : null}
      <CommunityReviewList listingId={listing.id} />
    </main>
  );
}

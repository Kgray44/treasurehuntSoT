import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityCardGrid } from "@/components/community/CommunityCardGrid";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { getHomeportCollectionDetail } from "@/community/homeport";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const identity = await requireCanonicalAccountIdentity();
  const collection = await getHomeportCollectionDetail((await params).slug, identity?.accountId);
  return collection
    ? harborSharingMetadata({
        kind: "collection",
        visibility: "COMMUNITY",
        canonicalPath: collection.card.destination,
        title: collection.card.title,
        safeDescription: collection.card.summary,
      })
    : harborSharingMetadata({ kind: "collection", visibility: "PRIVATE", canonicalPath: "/community/collections" });
}

export default async function CollectionPage({ params }: Props) {
  const identity = await requireCanonicalAccountIdentity();
  const collection = await getHomeportCollectionDetail((await params).slug, identity?.accountId);
  if (!collection) notFound();
  return (
    <CommunityPageFrame
      districtId="COLLECTIONS"
      eyebrow="Public collection"
      title={collection.card.title}
      description={collection.card.summary ?? "A curated public Community Harbor collection."}
    >
      <nav className="community-breadcrumbs" aria-label="Collection location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/collections">Collections</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{collection.card.title}</span>
      </nav>
      <section aria-labelledby="collection-items-title">
        <div className="community-section-heading">
          <div>
            <p className="community-eyebrow">Curated chart</p>
            <h2 id="collection-items-title">
              {collection.items.length} eligible {collection.items.length === 1 ? "entry" : "entries"}
            </h2>
            <p>Each reference is checked independently before it appears here.</p>
          </div>
        </div>
        {collection.items.length ? (
          <CommunityCardGrid cards={collection.items} label={`${collection.card.title} public entries`} />
        ) : (
          <section className="community-state community-state--district-empty">
            <h3>This public collection is empty</h3>
            <p>
              No currently eligible public entries are on this chart. Hidden or unavailable references are not
              described.
            </p>
            <Link className="community-button community-button--primary" href="/community/collections">
              Browse other Collections
            </Link>
          </section>
        )}
      </section>
    </CommunityPageFrame>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { getHomeportGuideDetail } from "@/community/homeport";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const identity = await requireCanonicalAccountIdentity();
  const guide = await getHomeportGuideDetail((await params).slug, identity?.accountId);
  return guide
    ? harborSharingMetadata({
        kind: "guide",
        visibility: "COMMUNITY",
        canonicalPath: guide.card.destination,
        title: guide.card.title,
        safeDescription: guide.card.summary,
      })
    : harborSharingMetadata({ kind: "guide", visibility: "PRIVATE", canonicalPath: "/community/guides" });
}

export default async function GuidePage({ params }: Props) {
  const identity = await requireCanonicalAccountIdentity();
  const guide = await getHomeportGuideDetail((await params).slug, identity?.accountId);
  if (!guide) notFound();
  return (
    <CommunityPageFrame
      districtId="GUIDES"
      eyebrow={guide.card.category ?? "Guide"}
      title={guide.card.title}
      description={guide.card.summary ?? "Public guidance from the Community Harbor."}
    >
      <nav className="community-breadcrumbs" aria-label="Guide location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/guides">Guides</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{guide.card.title}</span>
      </nav>
      <article className="community-guide-detail">
        <p className="community-eyebrow">Shipwright&apos;s Workshop</p>
        <h2>Practical guidance</h2>
        <div className="community-guide-detail__body">
          {guide.body.split(/\n{2,}/u).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {guide.card.creator ? (
          <p>
            Published by <Link href={guide.card.creator.destination}>{guide.card.creator.displayName}</Link>.
          </p>
        ) : null}
      </article>
    </CommunityPageFrame>
  );
}

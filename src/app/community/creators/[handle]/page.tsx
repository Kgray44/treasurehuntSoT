import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityCardGrid } from "@/components/community/CommunityCardGrid";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { CommunitySocialControls } from "@/components/community/CommunitySocialControls";
import { getHomeportCreatorDetail } from "@/community/homeport";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const identity = await requireCanonicalAccountIdentity();
  const creator = await getHomeportCreatorDetail((await params).handle, identity?.accountId);
  return creator
    ? harborSharingMetadata({
        kind: "creator",
        visibility: "COMMUNITY",
        canonicalPath: creator.card.destination,
        title: creator.card.title,
        safeDescription: creator.biography,
      })
    : harborSharingMetadata({ kind: "creator", visibility: "PRIVATE", canonicalPath: "/community/creators" });
}

export default async function CreatorPage({ params }: Props) {
  const identity = await requireCanonicalAccountIdentity();
  const creator = await getHomeportCreatorDetail((await params).handle, identity?.accountId);
  if (!creator) notFound();
  return (
    <CommunityPageFrame
      districtId="CREATORS"
      eyebrow="Community Creator"
      title={creator.card.title}
      description={creator.biography ?? "A public Community Harbor Creator Profile."}
    >
      <nav className="community-breadcrumbs" aria-label="Creator location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/creators">Creators</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{creator.card.title}</span>
      </nav>
      <section className="community-creator-profile" aria-labelledby="creator-profile-title">
        <div className="community-creator-profile__mark" aria-hidden="true">
          {initials(creator.card.title)}
        </div>
        <div>
          <p className="community-eyebrow">@{creator.handle}</p>
          <h2 id="creator-profile-title">Creator Profile</h2>
          {creator.biography ? <p>{creator.biography}</p> : null}
          <ul className="community-card__badges" aria-label="Creator summary">
            <li>
              {creator.followers} {creator.followers === 1 ? "follower" : "followers"}
            </li>
            <li>
              {creator.work.length} public {creator.work.length === 1 ? "work" : "works"}
            </li>
            {creator.languages.map((language) => (
              <li key={language}>{language}</li>
            ))}
            {creator.badges.map((badge) => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
          <CommunitySocialControls
            creatorProfileId={creator.card.id}
            subjectType="CREATOR"
            subjectId={creator.card.id}
          />
        </div>
      </section>
      <section className="community-creator-work" aria-labelledby="creator-work-title">
        <div className="community-section-heading">
          <div>
            <p className="community-eyebrow">Published work</p>
            <h2 id="creator-work-title">On this Creator&apos;s chart</h2>
          </div>
        </div>
        {creator.work.length ? (
          <CommunityCardGrid cards={creator.work} label={`${creator.card.title} published work`} />
        ) : (
          <section className="community-state community-state--district-empty">
            <h3>No public work yet</h3>
            <p>This Profile is public, but it has no currently eligible published Community entries.</p>
            <Link className="community-button community-button--primary" href="/community/creators">
              Browse other Creators
            </Link>
          </section>
        )}
      </section>
      {creator.collections.length ? (
        <section className="community-creator-work" aria-labelledby="creator-collections-title">
          <div className="community-section-heading">
            <div>
              <p className="community-eyebrow">Curated by this Creator</p>
              <h2 id="creator-collections-title">Public collections</h2>
            </div>
          </div>
          <CommunityCardGrid cards={creator.collections} label={`${creator.card.title} public collections`} />
        </section>
      ) : null}
    </CommunityPageFrame>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("");
}

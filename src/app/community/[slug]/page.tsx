import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { CommunityReviewList } from "@/components/community/CommunityReviewList";
import { CommunitySocialControls } from "@/components/community/CommunitySocialControls";
import type { CommunityDistrictId } from "@/community/districts";
import { getHomeportListingDetail } from "@/community/homeport";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const identity = await requireCanonicalAccountIdentity();
  const detail = await getHomeportListingDetail((await params).slug, identity?.accountId);
  if (!detail) return harborSharingMetadata({ kind: "listing", visibility: "PRIVATE", canonicalPath: "/community" });
  return harborSharingMetadata({
    kind: "listing",
    visibility: "COMMUNITY",
    canonicalPath: detail.card.destination,
    title: detail.card.title,
    safeDescription: detail.card.summary,
  });
}

export default async function CommunityListingPage({ params }: Props) {
  const identity = await requireCanonicalAccountIdentity();
  const detail = await getHomeportListingDetail((await params).slug, identity?.accountId);
  if (!detail || !detail.card.creator) notFound();
  const district = districtForVariant(detail.card.variant);
  const districtRoute = districtRouteForVariant(detail.card.variant);
  return (
    <CommunityPageFrame
      districtId={district}
      eyebrow={detail.card.contentType}
      title={detail.card.title}
      description={detail.card.summary ?? "A safe public Community Harbor listing."}
    >
      <nav className="community-breadcrumbs" aria-label="Listing location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href={districtRoute}>{districtLabel(detail.card.variant)}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{detail.card.title}</span>
      </nav>
      <article className="community-detail">
        <div
          className={`community-detail__art community-detail__art--${detail.card.variant.toLocaleLowerCase()}`}
          role="img"
          aria-label={detail.card.artwork.label}
        >
          <span aria-hidden="true">✦</span>
          <p>{detail.card.contentType}</p>
        </div>
        <div className="community-detail__body">
          <p className="community-eyebrow">Public listing</p>
          <h2>
            {detail.card.variant === "CHRONICLE"
              ? "Chronicle preview"
              : `About this ${detail.card.contentType.toLocaleLowerCase()}`}
          </h2>
          {detail.card.variant === "CHRONICLE" ? (
            <p className="community-availability">
              Preview shows public, preview-safe details only. Start Chronicle begins the published experience; it is a
              separate action.
            </p>
          ) : null}
          {detail.longDescription ? <p className="community-detail__lead">{detail.longDescription}</p> : null}
          <p>
            Created by <Link href={detail.card.creator.destination}>{detail.card.creator.displayName}</Link>
          </p>
          <DetailFacts detail={detail} />
          {detail.requirements ? <PracticalRequirements requirements={detail.requirements} /> : null}
          {detail.tags.length ? (
            <ul className="community-detail__tags" aria-label="Themes and tags">
              {detail.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {detail.warnings.length ? (
            <section className="community-detail__warning" aria-labelledby="community-warning-title">
              <h3 id="community-warning-title">Content notes</h3>
              <p>{detail.warnings.join(", ")}</p>
            </section>
          ) : null}
          <section className="community-detail__action" aria-labelledby="community-use-title">
            <p className="community-eyebrow">Next action</p>
            <h3 id="community-use-title">{detail.useAction.label}</h3>
            <p>{detail.useAction.detail}</p>
            {detail.useAction.kind === "LINK" ? (
              <Link className="community-button community-button--primary" href={detail.useAction.href}>
                {detail.useAction.label}
              </Link>
            ) : (
              <span className="community-availability">Not currently supported from public Community Harbor</span>
            )}
          </section>
          <CommunitySocialControls
            creatorProfileId={detail.card.creator.id}
            subjectType="LISTING"
            subjectId={detail.card.id}
          />
        </div>
      </article>
      <section className="community-detail-reviews" aria-labelledby="community-reviews-title">
        <h2 id="community-reviews-title">Community reviews</h2>
        <CommunityReviewList listingId={detail.card.id} />
      </section>
      <p className="community-detail-return">
        <Link href={districtRoute}>Return to {districtLabel(detail.card.variant)}</Link>
      </p>
    </CommunityPageFrame>
  );
}

function DetailFacts({ detail }: { detail: NonNullable<Awaited<ReturnType<typeof getHomeportListingDetail>>> }) {
  const facts = [
    detail.card.difficulty ? ["Difficulty", detail.card.difficulty] : null,
    detail.card.duration ? ["Duration", detail.card.duration] : null,
    detail.card.playerCount ? ["Crew", detail.card.playerCount] : null,
    detail.card.category ? ["Category", detail.card.category] : null,
    detail.release ? ["Release", detail.release.semanticVersion] : null,
    detail.release ? ["License", detail.release.license] : null,
    detail.release?.minimumPlatformVersion
      ? ["Minimum Voyagewright version", detail.release.minimumPlatformVersion]
      : null,
    detail.card.engagement?.reviewCount
      ? [
          "Rating",
          `${detail.card.engagement.rating?.toFixed(1) ?? "—"} from ${detail.card.engagement.reviewCount} ${detail.card.engagement.reviewCount === 1 ? "review" : "reviews"}`,
        ]
      : ["Rating", "Not yet rated"],
    ["Saves", String(detail.card.engagement?.saveCount ?? 0)],
  ].filter((fact): fact is [string, string] => Boolean(fact));
  return facts.length ? (
    <dl className="community-detail__facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  ) : null;
}

function PracticalRequirements({
  requirements,
}: {
  requirements: NonNullable<NonNullable<Awaited<ReturnType<typeof getHomeportListingDetail>>>["requirements"]>;
}) {
  const facts = [
    ["Environment", humanizeRequirement(requirements.environment)],
    ["Travel", humanizeRequirement(requirements.travel)],
    ["Physical props", humanizeRequirement(requirements.physicalProps)],
    ["Printing", humanizeRequirement(requirements.printing)],
    ...(requirements.setup ? [["Setup", humanizeRequirement(requirements.setup)]] : []),
    ["Vision Waypoint", requirements.visionWaypointRequired ? "Required" : "Not required"],
    ["Helper app", requirements.helperAppRequired ? "Required" : "Not required"],
    ["Offline support", requirements.offlineSupport ? "Available" : "Not declared"],
    ["Mobile support", requirements.mobileSupport ? "Available" : "Not declared"],
  ];
  return (
    <section aria-labelledby="community-requirements-title">
      <h3 id="community-requirements-title">Practical requirements</h3>
      <dl className="community-detail__facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function humanizeRequirement(value: string) {
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function districtForVariant(variant: string): CommunityDistrictId {
  return {
    CHRONICLE: "CHRONICLES",
    ARTIFACT: "ARTIFACTS",
    TEMPLATE: "TEMPLATES",
    MAP_OR_LOCATION_PACK: "MAPS_AND_LOCATION_PACKS",
    AUDIO_OR_REVEAL: "AUDIO_AND_REVEAL_ASSETS",
  }[variant] as CommunityDistrictId;
}

function districtRouteForVariant(variant: string) {
  return (
    {
      CHRONICLE: "/community/chronicles",
      ARTIFACT: "/community/artifacts",
      TEMPLATE: "/community/templates",
      MAP_OR_LOCATION_PACK: "/community/maps",
      AUDIO_OR_REVEAL: "/community/audio",
    }[variant] ?? "/community"
  );
}

function districtLabel(variant: string) {
  return (
    {
      CHRONICLE: "Chronicles",
      ARTIFACT: "Artifacts",
      TEMPLATE: "Templates",
      MAP_OR_LOCATION_PACK: "Maps",
      AUDIO_OR_REVEAL: "Audio and reveals",
    }[variant] ?? "Community Harbor"
  );
}

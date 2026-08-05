import Link from "next/link";
import { CommunityCardGrid } from "@/components/community/CommunityCardGrid";
import { CommunityDiscoveryBrowser } from "@/components/community/CommunityDiscoveryBrowser";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { visibleCommunityDistricts } from "@/community/districts";
import { getHomeportHarborShelves } from "@/community/homeport";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

export const metadata = {
  title: "Community Harbor",
  description: "Discover public Chronicles, artifacts, templates, maps, Guides, and consented Voyage Logs.",
};
export const dynamic = "force-dynamic";

export default async function CommunityHarborPage() {
  const identity = await requireCanonicalAccountIdentity();
  const shelves = await getHomeportHarborShelves(identity?.accountId);
  return (
    <CommunityPageFrame
      districtId="HARBOR_HOME"
      title="Find your next bearing"
      description="Explore useful Chronicles and shared craft from the Voyagewright Community. Begin with what is already on the shelves; search only when you need a narrower chart."
    >
      <CommunityDiscoveryBrowser compactLanding />

      {shelves.totalEligible ? (
        <div className="community-shelves">
          {shelves.featured.length ? (
            <HarborShelf
              id="featured-at-harbor"
              eyebrow="Selected by the Harbor"
              title="Featured at the Harbor"
              description="Editorially selected public work, clearly marked and safe to open."
              cards={shelves.featured}
              href="/community/featured"
            />
          ) : null}
          <HarborShelf
            id="recently-launched"
            eyebrow="Fresh arrivals"
            title="Recently launched"
            description="Newly published work, ordered by its public launch date."
            cards={shelves.recentlyLaunched}
            href="/community/chronicles?sort=NEWEST"
          />
          <HarborShelf
            id="recently-updated"
            eyebrow="Back on the chart"
            title="Recently updated"
            description="Public work with a recent meaningful release update."
            cards={shelves.recentlyUpdated}
            href="/community/chronicles?sort=RECENTLY_UPDATED"
          />
          <HarborShelf
            id="meet-the-makers"
            eyebrow="Creator watch"
            title="Meet the Makers"
            description="Public Creator Profiles and the eligible work they choose to share."
            cards={shelves.creatorHighlights}
            href="/community/creators"
          />
        </div>
      ) : (
        <section className="community-state community-state--harbor-empty" aria-labelledby="community-empty-title">
          <p className="community-eyebrow">The shelves are ready</p>
          <h2 id="community-empty-title">No public Community work has arrived yet</h2>
          <p>
            Nothing is wrong with your search: this Harbor does not yet contain an eligible published entry. You can
            still explore Voyagewright&apos;s published Chronicle Library.
          </p>
          <Link className="community-button community-button--primary" href="/tales">
            Explore Chronicles
          </Link>
        </section>
      )}

      <section className="community-district-directory" aria-labelledby="community-district-directory-title">
        <div className="community-section-heading">
          <div>
            <p className="community-eyebrow">Browse by district</p>
            <h2 id="community-district-directory-title">The whole Harbor, one chart</h2>
            <p>Every active district has the same destination on desktop and mobile.</p>
          </div>
        </div>
        <div className="community-district-directory__grid">
          {visibleCommunityDistricts
            .filter((district) => district.id !== "HARBOR_HOME")
            .map((district, index) => (
              <Link href={district.route} key={district.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{district.label}</strong>
                <small>{districtDescription(district.id)}</small>
              </Link>
            ))}
        </div>
      </section>
    </CommunityPageFrame>
  );
}

function HarborShelf({
  id,
  eyebrow,
  title,
  description,
  cards,
  href,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: Parameters<typeof CommunityCardGrid>[0]["cards"];
  href: string;
}) {
  if (!cards.length) return null;
  return (
    <section className="community-shelf" aria-labelledby={id}>
      <div className="community-section-heading">
        <div>
          <p className="community-eyebrow">{eyebrow}</p>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        <Link href={href}>
          View the full district <span aria-hidden="true">→</span>
        </Link>
      </div>
      <CommunityCardGrid cards={cards} label={title} compact />
    </section>
  );
}

function districtDescription(id: (typeof visibleCommunityDistricts)[number]["id"]) {
  return {
    HARBOR_HOME: "Community Harbor Home",
    FEATURED: "Editorial selections",
    CHRONICLES: "Published experiences",
    ARTIFACTS: "2D, 3D, and collected craft",
    TEMPLATES: "Reusable Chronicle structures",
    MAPS_AND_LOCATION_PACKS: "Fictional and public-safe places",
    AUDIO_AND_REVEAL_ASSETS: "Atmosphere and presentation resources",
    CREATORS: "Meet public Community Creators",
    COLLECTIONS: "Curated public charts",
    GUIDES: "Practical craft and care",
    SHIPWRIGHTS_WORKSHOP: "Guide category",
    VOYAGE_LOGS: "Consented, spoiler-safe memories",
  }[id];
}

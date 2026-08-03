import Link from "next/link";
import type { CommunityDistrictId } from "@/community/districts";
import {
  getHomeportHarborShelves,
  listHomeportCollectionCards,
  listHomeportCreatorCards,
  listHomeportGuideCards,
  listHomeportListingCards,
  listHomeportVoyageLogCards,
  type HomeportCommunityCard,
} from "@/community/homeport";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
import { CommunityCardGrid } from "./CommunityCardGrid";
import { CommunityDiscoveryBrowser } from "./CommunityDiscoveryBrowser";
import { CommunityPageFrame } from "./CommunityPageFrame";
import { CommunitySceneCeremony } from "./CommunitySceneCeremony";

export type CommunitySection =
  | "featured"
  | "chronicles"
  | "artifacts"
  | "templates"
  | "maps"
  | "audio"
  | "creators"
  | "voyage-logs"
  | "collections"
  | "guides";

const sections: Record<
  CommunitySection,
  {
    districtId: CommunityDistrictId;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    nearby: { label: string; href: string };
    lockedType?: "CHRONICLE" | "ARTIFACT" | "TEMPLATE" | "MAP" | "AUDIO";
  }
> = {
  featured: {
    districtId: "FEATURED",
    title: "Featured at the Harbor",
    description:
      "Editorially selected public work. Selection is explicit; ordinary popularity is never presented as endorsement.",
    emptyTitle: "No featured selections are on the chart",
    emptyDescription: "Public Community work may still be available in the other districts.",
    nearby: { label: "Browse Chronicles", href: "/community/chronicles" },
  },
  chronicles: {
    districtId: "CHRONICLES",
    title: "Chronicles",
    description:
      "Published experiences with useful details for duration, Crew size, difficulty, accessibility, and remix terms.",
    emptyTitle: "No public Chronicles yet",
    emptyDescription: "A Creator must publish an eligible Chronicle before it appears in this district.",
    nearby: { label: "Return to Harbor Home", href: "/community" },
    lockedType: "CHRONICLE",
  },
  artifacts: {
    districtId: "ARTIFACTS",
    title: "Artifacts",
    description:
      "Public 2D, 3D, and collection resources. This district is separate from the private Artifact Cabinet.",
    emptyTitle: "No public Artifacts yet",
    emptyDescription: "Private and unverified Artifact material is never used to fill this district.",
    nearby: { label: "Browse Templates", href: "/community/templates" },
    lockedType: "ARTIFACT",
  },
  templates: {
    districtId: "TEMPLATES",
    title: "Templates",
    description: "Reusable Chronicle and Passage structures with clear license and remix treatment where available.",
    emptyTitle: "No public Templates yet",
    emptyDescription:
      "The district remains ready for eligible reusable structures without displaying sample cards as real content.",
    nearby: { label: "Browse Guides", href: "/community/guides" },
    lockedType: "TEMPLATE",
  },
  maps: {
    districtId: "MAPS_AND_LOCATION_PACKS",
    title: "Maps and location packs",
    description:
      "Fictional and public-safe map resources. Private locations and exact protected coordinates never appear here.",
    emptyTitle: "No public maps yet",
    emptyDescription: "No private location material is substituted for an empty public district.",
    nearby: { label: "Browse Artifacts", href: "/community/artifacts" },
    lockedType: "MAP",
  },
  audio: {
    districtId: "AUDIO_AND_REVEAL_ASSETS",
    title: "Audio and reveal assets",
    description:
      "Public atmosphere, invitation, completion, and reveal resources with truthful accessibility metadata.",
    emptyTitle: "No public audio or reveal assets yet",
    emptyDescription: "Unscanned or unavailable media is not presented as ready content.",
    nearby: { label: "Browse Templates", href: "/community/templates" },
    lockedType: "AUDIO",
  },
  creators: {
    districtId: "CREATORS",
    title: "Creators",
    description:
      "Public Community profiles and their eligible published work, without private account or provider data.",
    emptyTitle: "No public Creators yet",
    emptyDescription: "Only active, Community-visible Creator profiles belong in this directory.",
    nearby: { label: "Browse Chronicles", href: "/community/chronicles" },
  },
  collections: {
    districtId: "COLLECTIONS",
    title: "Collections",
    description: "Curated public charts whose items are independently checked before they appear.",
    emptyTitle: "No public Collections yet",
    emptyDescription: "Private and archived collections remain absent without revealing their existence.",
    nearby: { label: "Browse Featured", href: "/community/featured" },
  },
  guides: {
    districtId: "GUIDES",
    title: "Guides and the Shipwright's Workshop",
    description:
      "Public, sanitized guidance for Chronicle craft and care. The Workshop is a Guide category, not a duplicate district.",
    emptyTitle: "No public Guides yet",
    emptyDescription: "Draft and deprecated guidance is never used to fill the public Workshop.",
    nearby: { label: "Browse Templates", href: "/community/templates" },
  },
  "voyage-logs": {
    districtId: "VOYAGE_LOGS",
    title: "Voyage Logs",
    description:
      "Verified, consented, spoiler-safe public memories. Private participant and location details remain outside the projection.",
    emptyTitle: "No consented public Voyage Logs yet",
    emptyDescription: "A Voyage Log appears only after completion and every required sharing consent remains active.",
    nearby: { label: "Browse Chronicles", href: "/community/chronicles" },
  },
};

export async function PublicCommunitySection({ section }: { section: CommunitySection }) {
  const identity = await requireCanonicalAccountIdentity();
  const detail = sections[section];
  const cards = await sectionCards(section, identity?.accountId);
  const scene =
    section === "featured"
      ? "community-featured-reveal"
      : section === "voyage-logs"
        ? "community-voyage-log-unfurl"
        : ("community-harbor-arrival" as const);
  return (
    <CommunitySceneCeremony sceneName={scene}>
      <CommunityPageFrame districtId={detail.districtId} title={detail.title} description={detail.description}>
        {cards.length ? (
          <section className="community-district-results" aria-labelledby="community-district-results-title">
            <div className="community-section-heading">
              <div>
                <p className="community-eyebrow">Public district</p>
                <h2 id="community-district-results-title">
                  {cards.length} {cards.length === 1 ? "entry" : "entries"} on this chart
                </h2>
              </div>
            </div>
            <CommunityCardGrid cards={cards} label={detail.title} />
          </section>
        ) : (
          <section
            className="community-state community-state--district-empty"
            aria-labelledby="community-district-empty-title"
          >
            <p className="community-eyebrow">District ready</p>
            <h2 id="community-district-empty-title">{detail.emptyTitle}</h2>
            <p>{detail.emptyDescription}</p>
            <Link className="community-button community-button--primary" href={detail.nearby.href}>
              {detail.nearby.label}
            </Link>
          </section>
        )}
        {detail.lockedType ? (
          <CommunityDiscoveryBrowser
            basePath={`/community/${section}`}
            lockedType={detail.lockedType}
            heading={`Search ${detail.title}`}
          />
        ) : null}
      </CommunityPageFrame>
    </CommunitySceneCeremony>
  );
}

async function sectionCards(
  section: CommunitySection,
  viewerAccountId?: string | null,
): Promise<readonly HomeportCommunityCard[]> {
  if (section === "featured") return (await getHomeportHarborShelves(viewerAccountId)).featured;
  if (section === "chronicles") return listHomeportListingCards("CHRONICLE", { viewerAccountId });
  if (section === "artifacts") return listHomeportListingCards("ARTIFACT", { viewerAccountId });
  if (section === "templates") return listHomeportListingCards("TEMPLATE", { viewerAccountId });
  if (section === "maps") return listHomeportListingCards("MAP_OR_LOCATION_PACK", { viewerAccountId });
  if (section === "audio") return listHomeportListingCards("AUDIO_OR_REVEAL", { viewerAccountId });
  if (section === "creators") return listHomeportCreatorCards(viewerAccountId);
  if (section === "collections") return listHomeportCollectionCards(viewerAccountId);
  if (section === "guides") return listHomeportGuideCards(viewerAccountId);
  return listHomeportVoyageLogCards();
}

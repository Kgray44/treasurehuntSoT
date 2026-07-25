import Link from "next/link";
import { db } from "@/lib/db";
import { listPublicListingsFoundation } from "@/community/services";
import { readPublicVoyageLogs } from "@/community/voyage-log-public";
import { CommunitySceneCeremony } from "./CommunitySceneCeremony";

export type CommunitySection = "featured" | "chronicles" | "artifacts" | "templates" | "maps" | "audio" | "creators" | "voyage-logs" | "collections" | "guides";

const copy: Record<CommunitySection, { title: string; description: string }> = {
  featured: { title: "Featured Harbor Charts", description: "Editorially selected public work." },
  chronicles: { title: "Chronicles", description: "Public experiences ready to discover." },
  artifacts: { title: "Artifacts", description: "Useful public relics and visual craft." },
  templates: { title: "Templates", description: "Reusable structures for new voyages." },
  maps: { title: "Maps", description: "Public map and location resources." },
  audio: { title: "Audio", description: "Public atmosphere and audio resources." },
  creators: { title: "Creators", description: "Public Community Harbor creators." },
  "voyage-logs": { title: "Voyage Logs", description: "Consented, spoiler-safe public memories." },
  collections: { title: "Collections", description: "Curated public Harbor collections." },
  guides: { title: "Shipwright's Workshop", description: "Public guides for craft and care." },
};

export async function PublicCommunitySection({ section }: { section: CommunitySection }) {
  const items = await sectionItems(section);
  const detail = copy[section];
  const scene = section === "featured" ? "community-featured-reveal" : section === "voyage-logs" ? "community-voyage-log-unfurl" : "community-harbor-arrival" as const;
  return (
    <CommunitySceneCeremony sceneName={scene}>
    <main className="page-shell" aria-labelledby="community-section-title">
      <p><Link href="/community">Back to Community Harbor</Link></p>
      <p className="eyebrow">Community Harbor</p>
      <h1 id="community-section-title">{detail.title}</h1>
      <p>{detail.description}</p>
      {items.length ? <ul aria-label={detail.title}>{items.map((item) => <li key={item.href}><article><h2><Link href={item.href}>{item.title}</Link></h2>{item.summary ? <p>{item.summary}</p> : null}</article></li>)}</ul> : <section aria-live="polite"><h2>No public entries yet</h2><p>This district will fill as safe, persisted Community records are published.</p></section>}
    </main>
    </CommunitySceneCeremony>
  );
}

async function sectionItems(section: CommunitySection): Promise<Array<{ href: string; title: string; summary?: string | null }>> {
  if (["featured", "chronicles", "artifacts", "templates", "maps", "audio"].includes(section)) {
    const listings = await listPublicListingsFoundation();
    const types: Record<string, string[] | undefined> = { chronicles: ["CHRONICLE"], artifacts: ["TWO_D_ARTIFACT", "THREE_D_ARTIFACT", "ARTIFACT_COLLECTION"], templates: ["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"], maps: ["MAP_PACK", "LOCATION_PACK"], audio: ["AUDIO_PACK"] };
    return listings.filter((listing) => section === "featured" ? true : !types[section] || types[section]?.includes(listing.itemType)).slice(0, 24).map((listing) => ({ href: `/community/${encodeURIComponent(listing.slug)}`, title: listing.title, summary: listing.shortDescription }));
  }
  if (section === "creators") return (await db.communityProfile.findMany({ where: { visibility: "COMMUNITY", moderationStatus: "ACTIVE" }, orderBy: { lastPublishedAt: "desc" }, take: 24 })).map((profile) => ({ href: `/community/creators/${encodeURIComponent(profile.handle)}`, title: profile.displayName, summary: profile.biography }));
  if (section === "guides") return (await db.communityGuideContent.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 24 })).map((guide) => ({ href: `/community/guides/${encodeURIComponent(guide.slug)}`, title: guide.title, summary: guide.safeSummary }));
  if (section === "collections") return (await db.communityCollection.findMany({ where: { visibility: "COMMUNITY", archivedAt: null, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 24 })).map((collection) => ({ href: `/community/collections/${encodeURIComponent(collection.slug)}`, title: collection.title, summary: collection.description }));
  return (await readPublicVoyageLogs()).map((log) => ({
    href: `/community/voyage-logs/${encodeURIComponent(log.slug)}`,
    title: log.title,
    summary: log.safeSummary,
  }));
}

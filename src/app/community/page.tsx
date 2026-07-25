import Link from "next/link";
import { listPublicListingsFoundation } from "@/community/services";

export const metadata = {
  title: "Community Harbor",
  description: "Discover public Chronicles, artifacts, guides, and safe Voyage Logs.",
};
export const dynamic = "force-dynamic";

export default async function CommunityHarborPage() {
  const listings = await listPublicListingsFoundation();

  return (
    <main className="page-shell" aria-labelledby="community-harbor-title">
      <p className="eyebrow">Community Harbor</p>
      <h1 id="community-harbor-title">Welcome to the Fleet</h1>
      <p>
        Discover useful Chronicles and shared craft. Public Harbor pages show only safe, published Community records.
      </p>
      <nav aria-label="Community Harbor districts">
        <ul>
          <li><Link href="/community?district=featured">Featured</Link></li>
          <li><Link href="/community?district=chronicles">Chronicles</Link></li>
          <li><Link href="/community?district=artifacts">Artifacts</Link></li>
          <li><Link href="/community?district=guides">Shipwright&apos;s Workshop</Link></li>
          <li><Link href="/community?district=voyage-logs">Voyage Logs</Link></li>
        </ul>
      </nav>
      {listings.length ? (
        <ul aria-label="Published Community listings">
          {listings.map((listing) => (
            <li key={listing.slug}>
              <article>
                <p>{listing.itemType}</p>
                <h2><Link href={`/community/${encodeURIComponent(listing.slug)}`}>{listing.title}</Link></h2>
                {listing.shortDescription ? <p>{listing.shortDescription}</p> : null}
                <p>By {listing.creator.displayName}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <section aria-live="polite">
          <h2>The Harbor is preparing its first public charts</h2>
          <p>There are no public listings to discover yet. Check back after a Creator publishes a safe Community release.</p>
        </section>
      )}
    </main>
  );
}

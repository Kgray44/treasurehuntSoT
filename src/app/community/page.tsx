import Link from "next/link";
import { CommunityDiscoveryBrowser } from "@/components/community/CommunityDiscoveryBrowser";

export const metadata = {
  title: "Community Harbor",
  description: "Discover public Chronicles, artifacts, guides, and safe Voyage Logs.",
};
export const dynamic = "force-dynamic";

export default function CommunityHarborPage() {
  return (
    <main className="page-shell" aria-labelledby="community-harbor-title">
      <p className="eyebrow">Community Harbor</p>
      <h1 id="community-harbor-title">Welcome to the Fleet</h1>
      <p>
        Discover useful Chronicles and shared craft. Public Harbor pages show only safe, published Community records.
      </p>
      <nav aria-label="Community Harbor districts">
        <ul>
          <li>
            <Link href="/community/featured">Featured</Link>
          </li>
          <li>
            <Link href="/community/chronicles">Chronicles</Link>
          </li>
          <li>
            <Link href="/community/artifacts">Artifacts</Link>
          </li>
          <li>
            <Link href="/community/guides">Shipwright&apos;s Workshop</Link>
          </li>
          <li>
            <Link href="/community/voyage-logs">Voyage Logs</Link>
          </li>
        </ul>
      </nav>
      <CommunityDiscoveryBrowser />
    </main>
  );
}

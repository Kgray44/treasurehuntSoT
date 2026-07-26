import Link from "next/link";
import { VoyageLogOwnerList } from "@/components/community/VoyageLogOwnerList";
export const dynamic = "force-dynamic";
export default function Page() { return <main className="page-shell" aria-labelledby="voyage-log-owner-title"><p><Link href="/community/voyage-logs">Back to Voyage Logs</Link></p><h1 id="voyage-log-owner-title">Your Voyage Log drafts</h1><p>Drafts remain private until every consent, media, provenance, spoiler, and sharing-policy check is ready.</p><VoyageLogOwnerList /></main>; }

import Link from "next/link";
import { VoyageLogMediaPanel } from "@/components/community/VoyageLogMediaPanel";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ voyageLogId?: string }> }) {
  const { voyageLogId } = await searchParams;
  return (
    <main className="page-shell" aria-labelledby="voyage-log-media-page-title">
      <p>
        <Link href="/community/voyage-logs">Back to Voyage Logs</Link>
      </p>
      <h1 id="voyage-log-media-page-title">Voyage Log media</h1>
      <VoyageLogMediaPanel voyageLogId={voyageLogId} />
    </main>
  );
}

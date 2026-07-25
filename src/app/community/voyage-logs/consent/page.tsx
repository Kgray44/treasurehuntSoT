import Link from "next/link";
import { VoyageLogConsentPanel } from "@/components/community/VoyageLogConsentPanel";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ voyageLogId?: string }> }) {
  const { voyageLogId } = await searchParams;
  return (
    <main className="page-shell" aria-labelledby="consent-page-title">
      <p>
        <Link href="/community/voyage-logs">Back to Voyage Logs</Link>
      </p>
      <h1 id="consent-page-title">Voyage Log publication consent</h1>
      <p>Publication consent is specific to this Voyage Log and can be revoked at any time.</p>
      <VoyageLogConsentPanel voyageLogId={voyageLogId} />
    </main>
  );
}

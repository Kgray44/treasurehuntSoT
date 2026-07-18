import Link from "next/link";
import { VisionReleaseReadiness } from "@/components/studio/VisionReleaseReadiness";
import { requireGmCapability } from "@/lib/security";
import { getVisionReleaseReadiness } from "@/vision/release-readiness";

export const dynamic = "force-dynamic";

export default async function ReleaseReadinessPage() {
  if (!(await requireGmCapability("CREATE_TALES")))
    return (
      <main className="studio-auth-gate">
        <section>
          <p className="eyebrow">Phase B-6 release authority</p>
          <h1>The release ledger is locked.</h1>
          <p>Sign in with a creator-capable account to inspect release evidence and blockers.</p>
          <Link className="brass-button" href="/quartermaster">
            Open Quartermaster login
          </Link>
        </section>
      </main>
    );
  const readiness = await getVisionReleaseReadiness();
  if (!readiness)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>No release baseline is persisted.</h1>
          <p>Run the migration and additive seed before interpreting readiness.</p>
        </section>
      </main>
    );
  return <VisionReleaseReadiness readiness={readiness} />;
}

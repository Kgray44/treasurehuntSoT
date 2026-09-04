import { CommunityWorkflowFrame } from "@/components/community/CommunityWorkflowFrame";
import { VoyageLogConsentPanel } from "@/components/community/VoyageLogConsentPanel";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ voyageLogId?: string }> }) {
  const { voyageLogId } = await searchParams;
  return (
    <CommunityWorkflowFrame
      title="Voyage Log publication consent"
      description="Consent is specific to this Voyage Log, can be revoked at any time, and never makes a private draft public by itself."
      backHref="/community/voyage-logs"
      backLabel="Public Voyage Logs"
    >
      <VoyageLogConsentPanel voyageLogId={voyageLogId} />
    </CommunityWorkflowFrame>
  );
}

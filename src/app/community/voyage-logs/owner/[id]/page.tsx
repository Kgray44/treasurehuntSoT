import { VoyageLogEditor } from "@/components/community/VoyageLogEditor";
import { CommunityWorkflowFrame } from "@/components/community/CommunityWorkflowFrame";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CommunityWorkflowFrame
      title="Prepare a Voyage Log"
      description="Edit the private record, collect the right authority, and review publication readiness without exposing draft details publicly."
      backHref="/community/voyage-logs/owner"
      backLabel="Your drafts"
    >
      <VoyageLogEditor voyageLogId={id} />
    </CommunityWorkflowFrame>
  );
}

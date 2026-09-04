import { CommunityWorkflowFrame } from "@/components/community/CommunityWorkflowFrame";
import { VoyageLogOwnerList } from "@/components/community/VoyageLogOwnerList";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <CommunityWorkflowFrame
      title="Your Voyage Log drafts"
      description="Drafts stay private until consent, media, provenance, spoiler, and sharing-policy checks are all ready."
      backHref="/community/voyage-logs"
      backLabel="Public Voyage Logs"
    >
      <VoyageLogOwnerList />
    </CommunityWorkflowFrame>
  );
}

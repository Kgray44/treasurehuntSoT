import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { WakebookVoyageDetail } from "@/components/wakebook/WakebookVoyageDetail";
export const dynamic = "force-dynamic";
export default async function PassportHistoryDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return (
    <AuthenticatedHarborPage
      returnTo={`/passport/history/${recordId}`}
      activeSection="passport-history"
      eyebrow="Chronicle Passport · Journey Archive"
      title="Voyage Detail"
      description="The exact edition, people, and private remembrance of one journey."
      capability="player"
    >
      <WakebookVoyageDetail recordId={recordId} />
    </AuthenticatedHarborPage>
  );
}

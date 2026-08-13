import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { WakebookArchive } from "@/components/wakebook/WakebookArchive";
export const dynamic = "force-dynamic";
export default function PassportHistoryPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/passport/history"
      activeSection="passport-history"
      eyebrow="Chronicle Passport"
      title="Your Voyages"
      description="Return to a private, version-pinned archive of the journeys you lived."
      capability="player"
    >
      <WakebookArchive />
    </AuthenticatedHarborPage>
  );
}

import { WakebookArchive } from "@/components/wakebook/WakebookArchive";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportHistoryPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/history"
      activeSection="passport-history"
      eyebrow="Chronicle Passport"
      title="Your Voyages"
      description="Return to a private, version-pinned archive of the journeys you lived."
      capability="player"
    >
      <WakebookArchive />
    </AuthenticatedPassportPage>
  );
}

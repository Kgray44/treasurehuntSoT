import { WakebookInsights } from "@/components/wakebook/WakebookInsights";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportTimelinePage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/timeline"
      activeSection="passport-timeline"
      eyebrow="Chronicle Passport · Journey Archive"
      title="Timeline"
      description="A private, truthful chronology of the Voyages you lived."
      capability="player"
    >
      <WakebookInsights view="timeline" />
    </AuthenticatedPassportPage>
  );
}

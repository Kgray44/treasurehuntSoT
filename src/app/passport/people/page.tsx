import { WakebookInsights } from "@/components/wakebook/WakebookInsights";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportPeoplePage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/people"
      activeSection="passport-people"
      eyebrow="Chronicle Passport · Journey Archive"
      title="People"
      description="Private historical crew context from the journeys you recorded."
      capability="player"
    >
      <WakebookInsights view="people" />
    </AuthenticatedPassportPage>
  );
}

import { WakebookInsights } from "@/components/wakebook/WakebookInsights";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportStatisticsPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/statistics"
      activeSection="passport-statistics"
      eyebrow="Chronicle Passport · Journey Archive"
      title="Statistics"
      description="Source-bound private patterns across your historical Voyage records."
      capability="player"
    >
      <WakebookInsights view="statistics" />
    </AuthenticatedPassportPage>
  );
}

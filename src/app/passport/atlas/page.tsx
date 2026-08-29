import { WakebookInsights } from "@/components/wakebook/WakebookInsights";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";

export const dynamic = "force-dynamic";

export default function PassportAtlasPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/atlas"
      activeSection="passport-atlas"
      eyebrow="Chronicle Passport · Journey Archive"
      title="Voyage Atlas"
      description="Seasonal private organization with truthful Landfall availability."
      capability="player"
    >
      <WakebookInsights view="atlas" />
    </AuthenticatedPassportPage>
  );
}

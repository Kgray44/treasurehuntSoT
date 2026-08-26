import { SavedExplorer } from "@/components/homeport/PassportSurfaces";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportSavedPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/saved"
      activeSection="passport-saved"
      eyebrow="Chronicle Passport"
      title="Saved from Community"
      description="Eligible public Community items you chose to keep close."
      capability="player"
    >
      <SavedExplorer />
    </AuthenticatedPassportPage>
  );
}

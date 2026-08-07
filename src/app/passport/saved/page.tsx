import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { SavedExplorer } from "@/components/homeport/PassportSurfaces";
export const dynamic = "force-dynamic";
export default function PassportSavedPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/passport/saved"
      activeSection="passport-saved"
      eyebrow="Chronicle Passport"
      title="Saved from Community"
      description="Eligible public Community items you chose to keep close."
      capability="player"
    >
      <SavedExplorer />
    </AuthenticatedHarborPage>
  );
}

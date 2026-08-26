import { ArtifactExplorer } from "@/components/homeport/PassportSurfaces";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportArtifactsPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/artifacts"
      activeSection="passport-artifacts"
      eyebrow="Chronicle Passport"
      title="Artifact Cabinet"
      description="Personal artifact records with visible ownership and provenance truth."
      capability="player"
    >
      <ArtifactExplorer />
    </AuthenticatedPassportPage>
  );
}

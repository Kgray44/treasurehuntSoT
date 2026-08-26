import { ArtifactDetail } from "@/components/homeport/PassportSurfaces";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default async function PassportArtifactDetailPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;
  return (
    <AuthenticatedPassportPage
      returnTo={`/passport/artifacts/${artifactId}`}
      activeSection="passport-artifacts"
      eyebrow="Chronicle Passport · Artifacts"
      title="Artifact Provenance"
      description="The authoritative or explicitly unresolved record behind this cabinet item."
      capability="player"
    >
      <ArtifactDetail artifactId={artifactId} />
    </AuthenticatedPassportPage>
  );
}

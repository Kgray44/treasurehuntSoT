import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { ArtifactExplorer } from "@/components/homeport/PassportSurfaces";
export const dynamic = "force-dynamic";
export default function PassportArtifactsPage() { return <AuthenticatedHarborPage returnTo="/passport/artifacts" activeSection="passport-artifacts" eyebrow="Chronicle Passport" title="Artifact Cabinet" description="Personal artifact records with visible ownership and provenance truth." capability="player"><ArtifactExplorer /></AuthenticatedHarborPage>; }

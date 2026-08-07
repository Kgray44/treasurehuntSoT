import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { PassportHome } from "@/components/homeport/PassportSurfaces";

export const dynamic = "force-dynamic";
export default function PassportPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/passport"
      activeSection="passport-home"
      eyebrow="Personal Harbor · Chronicle Passport"
      title="Chronicle Passport"
      description="Your private, record-led home for Voyage history, Memories, artifacts, and saved Community items."
      capability="player"
    >
      <PassportHome />
    </AuthenticatedHarborPage>
  );
}

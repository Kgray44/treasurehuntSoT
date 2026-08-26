import { PassportHome } from "@/components/homeport/PassportSurfaces";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";

export const dynamic = "force-dynamic";
export default function PassportPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport"
      activeSection="passport-home"
      eyebrow="The Living Journey Archive"
      title="Chronicle Passport"
      description="Your private, record-led home for Voyage history, Memories, artifacts, and saved Community items."
      capability="player"
    >
      <PassportHome />
    </AuthenticatedPassportPage>
  );
}

import { MemoriesExplorer } from "@/components/homeport/PassportSurfaces";
import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
export const dynamic = "force-dynamic";
export default function PassportMemoriesPage() {
  return (
    <AuthenticatedPassportPage
      returnTo="/passport/memories"
      activeSection="passport-memories"
      eyebrow="Chronicle Passport"
      title="Memories"
      description="Private notes attached to owner-authorized Chronicle records."
      capability="player"
    >
      <MemoriesExplorer />
    </AuthenticatedPassportPage>
  );
}

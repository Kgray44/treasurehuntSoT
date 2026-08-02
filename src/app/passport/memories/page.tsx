import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { MemoriesExplorer } from "@/components/homeport/PassportSurfaces";
export const dynamic = "force-dynamic";
export default function PassportMemoriesPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/passport/memories"
      activeSection="passport-memories"
      eyebrow="Chronicle Passport"
      title="Memories"
      description="Private notes attached to owner-authorized Chronicle records."
      capability="player"
    >
      <MemoriesExplorer />
    </AuthenticatedHarborPage>
  );
}

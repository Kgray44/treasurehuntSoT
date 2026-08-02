import { SecurityOverview } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";

export const dynamic = "force-dynamic";
export default function AccountSecurityPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/security"
      activeSection="security"
      eyebrow="Personal Harbor · Account"
      title="Security"
      description="Use accepted credential recovery and session authorities without duplicating sensitive proof."
    >
      <SecurityOverview />
    </AuthenticatedHarborPage>
  );
}

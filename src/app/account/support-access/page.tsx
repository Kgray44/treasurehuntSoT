import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { SupportAccessPanel } from "@/components/admiralty/SupportAccessPanel";

export const dynamic = "force-dynamic";

export default function SupportAccessPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/support-access"
      activeSection="support-access"
      eyebrow="Personal Harbor · Privacy"
      title="Support Access"
      description="Review exact diagnostic categories, make your own decision, and end active access at any time."
    >
      <SupportAccessPanel />
    </AuthenticatedHarborPage>
  );
}

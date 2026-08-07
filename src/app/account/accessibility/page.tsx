import { PreferenceEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function AccessibilityPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/accessibility"
      activeSection="accessibility"
      eyebrow="Personal Harbor · Experience"
      title="Accessibility"
      description="Set personal presentation preferences while keeping browser and operating-system overrides authoritative."
    >
      <PreferenceEditor mode="accessibility" />
    </AuthenticatedHarborPage>
  );
}

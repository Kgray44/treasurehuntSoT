import { PreferenceEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function NotificationsPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/notifications"
      activeSection="notifications"
      eyebrow="Personal Harbor · Experience"
      title="Notifications"
      description="Choose accepted notification intent without implying an unavailable delivery provider."
    >
      <PreferenceEditor mode="notifications" />
    </AuthenticatedHarborPage>
  );
}

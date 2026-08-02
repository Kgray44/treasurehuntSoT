import { SessionManager } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function SessionsPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/sessions"
      activeSection="sessions-devices"
      eyebrow="Personal Harbor · Account"
      title="Sessions & Devices"
      description="Review safe AccountSession summaries, revoke access, or sign out everywhere."
    >
      <SessionManager />
    </AuthenticatedHarborPage>
  );
}

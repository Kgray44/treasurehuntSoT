import { PreferenceEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function PreferencesPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/preferences"
      activeSection="preferences"
      eyebrow="Personal Harbor · Experience"
      title="Preferences"
      description="Choose typed experience and discovery defaults that follow you across Voyagewright."
    >
      <PreferenceEditor mode="preferences" />
    </AuthenticatedHarborPage>
  );
}

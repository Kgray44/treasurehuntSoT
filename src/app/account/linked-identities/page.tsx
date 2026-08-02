import { LinkedIdentities } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function LinkedIdentitiesPage() {
  return (
    <AuthenticatedHarborPage
      returnTo="/account/linked-identities"
      activeSection="linked-identities"
      eyebrow="Personal Harbor · Privacy & connections"
      title="Linked Identities"
      description="Review safe connection summaries, connect configured providers, and avoid login lockout."
    >
      <LinkedIdentities />
    </AuthenticatedHarborPage>
  );
}

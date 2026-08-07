import { ProfileEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default async function AccountProfilePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = safeCommunityReturn(requestedReturn);
  return (
    <AuthenticatedHarborPage
      returnTo={returnTo ?? "/account/profile"}
      activeSection="public-profile-editor"
      eyebrow="Personal Harbor · Profile"
      title="Public Profile"
      description="Shape the identity other people may see, with an exact server-projected public preview."
    >
      <ProfileEditor returnTo={returnTo} />
    </AuthenticatedHarborPage>
  );
}

function safeCommunityReturn(value?: string) {
  if (!value || value.length > 500 || !value.startsWith("/community/") || value.startsWith("//")) return undefined;
  return value;
}

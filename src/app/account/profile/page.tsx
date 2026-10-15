import { ProfileEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default async function AccountProfilePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = safeProfileReturn(requestedReturn);
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

function safeProfileReturn(value?: string) {
  if (!value || value.length > 500 || !value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.startsWith("/community/")) return value;
  try {
    const destination = new URL(value, "https://profile-return.invalid");
    if (destination.pathname !== "/studio/parallax" || destination.hash) return undefined;
    if ([...destination.searchParams.keys()].some((key) => key !== "definition")) return undefined;
    const definition = destination.searchParams.get("definition");
    if (definition && !/^[a-zA-Z0-9_-]{1,120}$/.test(definition)) return undefined;
    return destination.pathname + destination.search;
  } catch {
    return undefined;
  }
}

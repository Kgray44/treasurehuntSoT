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
    if (
      destination.origin !== "https://profile-return.invalid" ||
      destination.pathname !== "/studio/parallax" ||
      destination.hash
    )
      return undefined;
    const keys = [...destination.searchParams.keys()];
    if (keys.every((key) => key === "definition") && keys.length <= 1) {
      const definition = destination.searchParams.get("definition");
      if (definition && !/^[a-zA-Z0-9_-]{1,120}$/.test(definition)) return undefined;
    } else {
      if (
        keys.length !== 3 ||
        new Set(keys).size !== 3 ||
        !keys.every((key) => ["library", "libraryKind", "libraryVersion"].includes(key))
      )
        return undefined;
      const entry = destination.searchParams.get("library");
      const version = destination.searchParams.get("libraryVersion");
      if (
        !entry ||
        !/^environment:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(entry) ||
        destination.searchParams.get("libraryKind") !== "ENVIRONMENTS" ||
        !version ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(version)
      )
        return undefined;
    }
    return destination.pathname + destination.search;
  } catch {
    return undefined;
  }
}

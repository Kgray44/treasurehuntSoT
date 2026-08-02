import { ProfileEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function AccountProfilePage() { return <AuthenticatedHarborPage returnTo="/account/profile" activeSection="public-profile-editor" eyebrow="Personal Harbor · Profile" title="Public Profile" description="Shape the identity other people may see, with an exact server-projected public preview."><ProfileEditor /></AuthenticatedHarborPage>; }

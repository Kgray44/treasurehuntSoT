import { PrivacyEditor } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function PrivacyPage() { return <AuthenticatedHarborPage returnTo="/account/privacy" activeSection="privacy-safety" eyebrow="Personal Harbor · Privacy & connections" title="Privacy & Safety" description="Control server-enforced public Profile visibility, section by section."><PrivacyEditor /></AuthenticatedHarborPage>; }

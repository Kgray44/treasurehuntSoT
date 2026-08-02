import { PersonalInformation } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function PersonalInformationPage() { return <AuthenticatedHarborPage returnTo="/account/personal-information" activeSection="personal-information" eyebrow="Personal Harbor · Profile" title="Personal Information" description="Review account-held identity information and change only what accepted services support."><PersonalInformation /></AuthenticatedHarborPage>; }

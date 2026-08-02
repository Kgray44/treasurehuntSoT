import { AccountOverview } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function AccountPage() { return <AuthenticatedHarborPage returnTo="/account" activeSection="personal-harbor-overview" eyebrow="Personal Harbor" title="Overview" description="Your private home for Profile, preferences, connections, Chronicle records, and account care."><AccountOverview /></AuthenticatedHarborPage>; }

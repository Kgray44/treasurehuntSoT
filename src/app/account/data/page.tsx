import { DataAccount } from "@/components/homeport/AccountSurfaces";
import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
export const dynamic = "force-dynamic";
export default function DataAccountPage() { return <AuthenticatedHarborPage returnTo="/account/data" activeSection="data-account" eyebrow="Personal Harbor · Account" title="Data & Account" description="See which account-data operations are actually supported by accepted services today."><DataAccount /></AuthenticatedHarborPage>; }

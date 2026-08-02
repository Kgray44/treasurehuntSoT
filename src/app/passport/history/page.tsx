import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { HistoryExplorer } from "@/components/homeport/PassportSurfaces";
export const dynamic = "force-dynamic";
export default function PassportHistoryPage() { return <AuthenticatedHarborPage returnTo="/passport/history" activeSection="passport-history" eyebrow="Chronicle Passport" title="Chronicle History" description="Owner-authorized, version-pinned records from Voyages you joined." capability="player"><HistoryExplorer /></AuthenticatedHarborPage>; }

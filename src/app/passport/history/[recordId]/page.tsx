import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { HistoryDetail } from "@/components/homeport/PassportSurfaces";
export const dynamic = "force-dynamic";
export default async function PassportHistoryDetailPage({ params }: { params: Promise<{ recordId: string }> }) { const { recordId } = await params; return <AuthenticatedHarborPage returnTo={`/passport/history/${recordId}`} activeSection="passport-history" eyebrow="Chronicle Passport · History" title="Chronicle Record" description="A private, exact record bound to its published Chronicle version." capability="player"><HistoryDetail recordId={recordId} /></AuthenticatedHarborPage>; }

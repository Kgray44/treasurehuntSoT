import { CaptainDashboard } from "@/components/captain/CaptainDashboard";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function CaptainTalePage({ params }: { params: Promise<{ taleId: string }> }) {
  return (
    <CaptainDashboard
      authenticated={Boolean(await requireGmCapability("CAPTAIN"))}
      taleFilter={(await params).taleId}
    />
  );
}

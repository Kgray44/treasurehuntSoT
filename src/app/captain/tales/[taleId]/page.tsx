import { CaptainDashboard } from "@/components/captain/CaptainDashboard";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function CaptainTalePage({ params }: { params: Promise<{ taleId: string }> }) {
  return (
    <CaptainDashboard
      authenticated={(await resolveCapability("captain")).status === "allowed"}
      taleFilter={(await params).taleId}
    />
  );
}

import { CaptainDashboard } from "@/components/captain/CaptainDashboard";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function CaptainPage() {
  return <CaptainDashboard authenticated={Boolean(await requireGmCapability("CAPTAIN"))} />;
}

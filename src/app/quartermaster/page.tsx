import { Quartermaster } from "@/components/gm/Quartermaster";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function QuartermasterPage() {
  return <Quartermaster authenticated={Boolean(await requireGmCapability("CAPTAIN"))} />;
}

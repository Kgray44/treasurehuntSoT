import { NewTaleForm } from "@/components/studio/NewTaleForm";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function NewTalePage() {
  return <NewTaleForm authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />;
}

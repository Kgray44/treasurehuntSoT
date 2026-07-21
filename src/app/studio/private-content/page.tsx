import { PrivateContentConsole } from "@/components/studio/PrivateContentConsole";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function PrivateContentPage() {
  return <PrivateContentConsole authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />;
}

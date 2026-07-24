import { StudioExchangeConsole } from "@/components/community/StudioExchangeConsole";
import { requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function StudioExchangePage() {
  return <StudioExchangeConsole authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />;
}

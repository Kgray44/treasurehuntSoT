import { StudioExchangeConsole } from "@/components/community/StudioExchangeConsole";
import { resolveCapability } from "@/homeport/current-user.server";

export const dynamic = "force-dynamic";

export default async function StudioExchangePage() {
  return <StudioExchangeConsole authenticated={(await resolveCapability("creator")).status === "allowed"} />;
}

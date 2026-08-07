import { PrivateContentConsole } from "@/components/studio/PrivateContentConsole";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function PrivateContentPage() {
  return <PrivateContentConsole authenticated={(await resolveCapability("creator")).status === "allowed"} />;
}

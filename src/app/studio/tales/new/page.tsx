import { NewTaleForm } from "@/components/studio/NewTaleForm";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function NewTalePage() {
  return <NewTaleForm authenticated={(await resolveCapability("creator")).status === "allowed"} />;
}

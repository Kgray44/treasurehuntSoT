import { VisionWaypointLibrary } from "@/components/studio/VisionWaypointLibrary";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function VisionWaypointsPage() {
  return <VisionWaypointLibrary authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />;
}

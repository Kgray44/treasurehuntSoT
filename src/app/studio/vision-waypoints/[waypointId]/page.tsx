import { VisionWaypointEditor } from "@/components/studio/VisionWaypointEditor";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function VisionWaypointPage({ params }: { params: Promise<{ waypointId: string }> }) {
  return (
    <VisionWaypointEditor
      waypointId={(await params).waypointId}
      authenticated={Boolean(await requireGmCapability("CREATE_TALES"))}
    />
  );
}

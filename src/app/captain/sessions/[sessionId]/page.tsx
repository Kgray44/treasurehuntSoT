import { CaptainSessionControl } from "@/components/captain/CaptainSessionControl";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function CaptainSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <CaptainSessionControl
      sessionId={(await params).sessionId}
      authenticated={(await resolveCapability("captain")).status === "allowed"}
    />
  );
}

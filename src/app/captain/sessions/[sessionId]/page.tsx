import { CaptainSessionControl } from "@/components/captain/CaptainSessionControl";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function CaptainSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <CaptainSessionControl
      sessionId={(await params).sessionId}
      authenticated={Boolean(await requireGmCapability("CAPTAIN"))}
    />
  );
}

import { CaptainSessionControl } from "@/components/captain/CaptainSessionControl";
import { CaptainOperationalPanel } from "@/components/captain/CaptainOperationalPanel";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function CaptainSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const sessionId = (await params).sessionId;
  const authenticated = (await resolveCapability("captain")).status === "allowed";
  return (
    <>
      <CaptainOperationalPanel voyageId={sessionId} authenticated={authenticated} />
      <CaptainSessionControl sessionId={sessionId} authenticated={authenticated} />
    </>
  );
}

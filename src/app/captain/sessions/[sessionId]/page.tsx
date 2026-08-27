import { CaptainCommandConsole } from "@/components/captain/CaptainCommandConsole";
import { CaptainOperationalPanel } from "@/components/captain/CaptainOperationalPanel";
import { resolveCapability } from "@/homeport/current-user.server";
export const dynamic = "force-dynamic";
export default async function CaptainSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const sessionId = (await params).sessionId;
  const authenticated = (await resolveCapability("captain")).status === "allowed";
  return (
    <>
      <CaptainOperationalPanel voyageId={sessionId} authenticated={authenticated} />
      <CaptainCommandConsole voyageId={sessionId} authenticated={authenticated} />
    </>
  );
}

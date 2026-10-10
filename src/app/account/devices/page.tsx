import { AuthenticatedHarborPage } from "@/components/homeport/AuthenticatedHarborPage";
import { CrossdeckDevices } from "@/components/crossdeck/CrossdeckDevices";
export const metadata = { title: "Voyage devices · Voyagewright", referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ voyage?: string }> }) {
  const { voyage } = await searchParams;
  return (
    <AuthenticatedHarborPage
      returnTo={`/account/devices${voyage ? `?voyage=${encodeURIComponent(voyage)}` : ""}`}
      activeSection="sessions-devices"
      eyebrow="Personal Harbor · Devices"
      title="Voyage devices"
      description="Bring your phone or another screen into the same Voyage."
    >
      <CrossdeckDevices initialVoyage={voyage} />
    </AuthenticatedHarborPage>
  );
}

import { redirect } from "next/navigation";
import { requirePlayerIdentity } from "@/platform/auth";
import { CrossdeckCompanionGateway } from "@/components/crossdeck/CrossdeckCompanionGateway";
import { companionHref } from "@/crossdeck/experiences";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voyage companion · Voyagewright", referrer: "no-referrer" };

export default async function CompanionPage({ searchParams }: { searchParams: Promise<{ voyage?: string }> }) {
  const voyageId = (await searchParams).voyage ?? "";
  if (!(await requirePlayerIdentity()))
    redirect(`/player/sign-in?returnTo=${encodeURIComponent(companionHref(voyageId))}`);
  return <CrossdeckCompanionGateway key={voyageId} voyageId={voyageId} />;
}

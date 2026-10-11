import { CrossdeckDisplay } from "@/components/crossdeck/CrossdeckDisplay";
export default async function CrewDisplayPage({ searchParams }: { searchParams: Promise<{ voyage?: string }> }) {
  return <CrossdeckDisplay voyageId={(await searchParams).voyage ?? ""} />;
}

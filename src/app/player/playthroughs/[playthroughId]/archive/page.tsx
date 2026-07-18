import { redirect } from "next/navigation";
import { VoyageArchive } from "@/components/platform/VoyageArchive";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function VoyageArchivePage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  return <VoyageArchive playthroughId={(await params).playthroughId} />;
}

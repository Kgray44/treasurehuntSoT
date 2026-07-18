import { redirect } from "next/navigation";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function VoyageArchivePage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  redirect(`/player/playthroughs/${encodeURIComponent((await params).playthroughId)}/journal/chapters`);
}

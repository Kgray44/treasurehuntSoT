import { redirect } from "next/navigation";
import { PlayerLibrary } from "@/components/platform/PlayerLibrary";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function PlayerLibraryPage() {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in?return=/player/library");
  return <PlayerLibrary />;
}

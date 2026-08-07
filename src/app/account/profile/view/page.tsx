import { redirect } from "next/navigation";
import { requireWayfarerAccount } from "@/wayfarer/http";

export const dynamic = "force-dynamic";

export default async function ViewMyProfilePage() {
  const session = await requireWayfarerAccount();
  if (!session) redirect("/sign-in?returnTo=%2Faccount%2Fprofile%2Fview");
  const handle = session.account.profile?.handle;
  redirect(handle ? `/profile/${encodeURIComponent(handle)}` : "/account/profile?profileDestination=missing");
}

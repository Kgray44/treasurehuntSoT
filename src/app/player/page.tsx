import { redirect } from "next/navigation";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function PlayerPage() {
  redirect((await requirePlayerIdentity()) ? "/player/library" : "/player/sign-in");
}

import { CaptainLibrary } from "@/components/platform/CaptainLibrary";
import { requireGmCapability } from "@/lib/security";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function CaptainPage() {
  if (!(await requireGmCapability("CAPTAIN"))) redirect("/captain/sign-in");
  return <CaptainLibrary />;
}

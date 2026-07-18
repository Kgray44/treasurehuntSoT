import { redirect } from "next/navigation";
import { CaptainLibrary } from "@/components/platform/CaptainLibrary";
import { requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";
export default async function CaptainLibraryPage() {
  if (!(await requireGmCapability("CAPTAIN"))) redirect("/captain/sign-in?return=/captain/library");
  return <CaptainLibrary />;
}

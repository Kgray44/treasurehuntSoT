import { StaffSignIn } from "@/components/platform/StaffSignIn";
import { requireGm, requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";
export default async function CaptainSignInPage() {
  const [staff, captain] = await Promise.all([requireGm(), requireGmCapability("CAPTAIN")]);
  return <StaffSignIn intent="captain" signedIn={Boolean(staff)} authorized={Boolean(captain)} />;
}

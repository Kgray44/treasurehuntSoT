import { StaffSignIn } from "@/components/platform/StaffSignIn";
import { requireGm, requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";
export default async function StudioSignInPage() {
  const [staff, creator] = await Promise.all([requireGm(), requireGmCapability("CREATE_TALES")]);
  return <StaffSignIn intent="creator" signedIn={Boolean(staff)} authorized={Boolean(creator)} />;
}

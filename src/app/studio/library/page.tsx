import { StudioHome } from "@/components/studio/StudioHome";
import { requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";
export default async function StudioLibraryPage() {
  return <StudioHome authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />;
}

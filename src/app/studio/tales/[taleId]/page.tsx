import { TaleEditor } from "@/components/studio/TaleEditor";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function EditorPage({ params }: { params: Promise<{ taleId: string }> }) {
  return (
    <TaleEditor taleId={(await params).taleId} authenticated={Boolean(await requireGmCapability("CREATE_TALES"))} />
  );
}

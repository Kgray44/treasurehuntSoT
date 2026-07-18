import { TaleEditor } from "@/components/studio/TaleEditor";
import { requireGmCapability } from "@/lib/security";
export async function TaleEditorSection({
  taleId,
  section,
}: {
  taleId: string;
  section: "settings" | "assets" | "locations" | "artifacts" | "versions";
}) {
  return (
    <TaleEditor
      taleId={taleId}
      initialSection={section}
      authenticated={Boolean(await requireGmCapability("CREATE_TALES"))}
    />
  );
}

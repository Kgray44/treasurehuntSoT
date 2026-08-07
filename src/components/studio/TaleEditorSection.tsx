import { TaleEditor } from "@/components/studio/TaleEditor";
import { PermissionState } from "@/components/ui/AsyncState";
import { requireOwnedStudioTale, requireStudioWorkspace } from "@/chronicle/studio-authorization";
export async function TaleEditorSection({
  taleId,
  section,
}: {
  taleId: string;
  section?: "settings" | "assets" | "locations" | "artifacts" | "versions";
}) {
  const workspace = await requireStudioWorkspace();
  if (!workspace) return <TaleEditor taleId={taleId} initialSection={section} authenticated={false} />;
  if (!(await requireOwnedStudioTale(taleId)))
    return (
      <main className="studio-auth-gate">
        <PermissionState
          primaryHeading
          title="Chronicle access unavailable"
          detail="Your account can use Creator Studio, but this private Chronicle is not owned by or shared with you."
          action={{ label: "Return to Chronicle Library", href: "/studio/library" }}
        />
      </main>
    );
  return <TaleEditor taleId={taleId} initialSection={section} authenticated />;
}

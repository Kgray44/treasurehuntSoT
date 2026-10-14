import { redirect } from "next/navigation";
import { requireStudioWorkspace, requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { SpatialStudio } from "@/components/studio/parallax/SpatialStudio";
import { signInHref } from "@/homeport/return-to";
export const dynamic = "force-dynamic";
export default async function SpatialStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const chronicleId = value("chronicle");
  if (!(await requireStudioWorkspace())) redirect(signInHref("/studio/parallax", "auth-required"));
  if (chronicleId && !(await requireOwnedStudioTale(chronicleId)))
    return (
      <main>
        <h1>Chronicle unavailable</h1>
        <a href="/studio/library">Return to Creator Studio</a>
      </main>
    );
  return (
    <SpatialStudio
      key={[chronicleId, value("definition"), value("entity"), value("block"), value("environment")].join(":")}
      chronicleId={chronicleId}
      definitionId={value("definition")}
      entityId={value("entity")}
      blockId={value("block")}
      environmentDefinitionId={value("environment")}
    />
  );
}

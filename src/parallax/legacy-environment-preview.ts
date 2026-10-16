import type { DraftContent } from "./authoring";
import type { PreviewEnvironment } from "./environment-authoring";
import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import type { EnvironmentContent, EnvironmentVersion } from "./legacy-scene-environment-contracts";
export type LegacyPreviewEnvironment = PreviewEnvironment & Pick<EnvironmentContent, "fixtures" | "evidence">;
/** Read-only renderer projection. No rich room, furniture or semantic feature is invented. */
export function projectLegacyEnvironmentPreview(
  version: EnvironmentVersion,
  lighting: DraftContent["scenePresentation"] = undefined,
): LegacyPreviewEnvironment {
  const content = structuredClone(version.content);
  if (lighting?.lighting === "NORMAL" || lighting?.lighting === "LOW") content.light = lighting.lighting;
  return content;
}
/** The caller retains its catalog-loading state. An available legacy record must match all pin fields. */
export function legacyScenePreviewEnvironment(content: DraftContent, records: CompatibleEnvironmentRecord[]) {
  const pin = content.environment;
  if (!pin) return null;
  const record = records.find((record) => record.id === pin.environmentId);
  if (!record || record.representation !== "SC01_SCHEMA1") return null;
  const version = record.versions.find((version) => version.reference.versionId === pin.versionId);
  if (
    !version ||
    version.reference.environmentId !== pin.environmentId ||
    version.reference.revision !== pin.revision ||
    version.reference.checksum !== pin.checksum
  )
    throw new Error(
      "The exact legacy Environment version is unavailable. Reload its catalog before previewing this Scene.",
    );
  if (content.studio?.environment)
    throw new Error("A legacy Environment pin cannot preview an unrelated rich room snapshot.");
  return projectLegacyEnvironmentPreview(version, content.scenePresentation);
}

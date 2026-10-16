import { z } from "zod";
import { canonicalChecksum } from "@/drydock/canonical";
import { environmentReferenceSchema } from "./environment-reference";
import { validateSpatialMoment } from "./publication";
import type { SpatialMoment } from "./contracts";

const id = z.string().min(1).max(128);
/** Future Story Block handoff. Consumers must retain every pin when publishing. */
export const sceneReferenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sceneDefinitionId: id,
  sceneVersionId: id,
  sceneChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  environment: environmentReferenceSchema,
  behaviorIds: z.array(id).max(64),
  transition: z.enum(["CUT", "PRESERVE_ENVIRONMENT"]),
});
export type SceneReference = z.infer<typeof sceneReferenceSchema>;
export function sceneReference(
  moment: SpatialMoment,
  transition: SceneReference["transition"] = "CUT",
): SceneReference {
  const checked = validateSpatialMoment(moment);
  if (!checked.version.environment)
    throw new Error("Associate and release an Environment-bound Scene before creating a Chronicle reference.");
  return sceneReferenceSchema.parse({
    schemaVersion: 1,
    sceneDefinitionId: checked.definition.id,
    sceneVersionId: checked.version.id,
    sceneChecksum: checked.version.checksum,
    environment: checked.version.environment,
    behaviorIds: checked.version.studio?.behaviors.map((b) => b.id) ?? [],
    transition,
  });
}
export function validateSceneReference(raw: unknown, moment: SpatialMoment) {
  const reference = sceneReferenceSchema.parse(raw);
  const expected = sceneReference(moment, reference.transition);
  if (canonicalChecksum(reference) !== canonicalChecksum(expected))
    throw new Error("Scene reference does not match its immutable release.");
  return reference;
}

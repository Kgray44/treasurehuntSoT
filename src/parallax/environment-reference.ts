import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
/** Immutable association. Scene saves never resolve this to a moving latest version. */
export const environmentReferenceSchema = z.strictObject({
  environmentId: id,
  versionId: id,
  revision: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export const environmentPlacementsSchema = z.array(z.strictObject({ entityId: id, featureId: id })).max(32);
export type EnvironmentReference = z.infer<typeof environmentReferenceSchema>;

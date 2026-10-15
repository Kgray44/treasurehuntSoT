import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const id = identifier.max(128);
/** Immutable association. Scene saves never resolve this to a moving latest version. */
export const environmentReferenceSchema = z.strictObject({
  environmentId: id,
  // Existing lifecycle releases permit 160 characters; never truncate an exact pin.
  versionId: identifier.max(160),
  revision: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export const environmentPlacementsSchema = z.array(z.strictObject({ entityId: id, featureId: id })).max(32);
export type EnvironmentReference = z.infer<typeof environmentReferenceSchema>;

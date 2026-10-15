import { z } from "zod";
import { environmentEvidenceSchema } from "./adaptive";
import { environmentReferenceSchema } from "./environment-reference";

const id = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const point = z.strictObject({
  x: z.number().finite().min(-20).max(20),
  y: z.number().finite().min(0).max(10),
  z: z.number().finite().min(-20).max(20),
});
export const environmentContentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2000),
    origin: z.enum(["BUILTIN", "MANUAL", "RECONSTRUCTED"]),
    sourceLabel: z.string().trim().min(1).max(240),
    width: z.number().finite().min(2).max(20),
    depth: z.number().finite().min(2).max(20),
    horizontal: z.boolean(),
    vertical: z.boolean(),
    light: z.enum(["NORMAL", "LOW"]),
    clutter: z.number().finite().min(0).max(1),
    tracking: z.boolean(),
    // Canonical semantic geometry; no room images, private evidence or device authority.
    evidence: environmentEvidenceSchema,
    fixtures: z
      .array(
        z.strictObject({
          id,
          name: z.string().trim().min(1).max(160),
          kind: z.enum(["FURNITURE", "ARCHITECTURE", "SURFACE"]),
          position: point,
          size: z.strictObject({
            x: z.number().finite().positive().max(20),
            y: z.number().finite().positive().max(10),
            z: z.number().finite().positive().max(20),
          }),
          color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
        }),
      )
      .max(32),
  })
  .superRefine((e, ctx) => {
    if (new Set(e.fixtures.map((f) => f.id)).size !== e.fixtures.length)
      ctx.addIssue({ code: "custom", message: "Environment fixture identities must be unique." });
    for (const f of e.fixtures)
      if (Math.abs(f.position.x) + f.size.x / 2 > e.width / 2 || Math.abs(f.position.z) + f.size.z / 2 > e.depth / 2)
        ctx.addIssue({ code: "custom", message: `${f.name} extends outside the Environment.` });
    for (const f of e.evidence.candidates)
      if (Math.abs(f.position.x) > e.width / 2 || Math.abs(f.position.z) > e.depth / 2)
        ctx.addIssue({ code: "custom", message: `Semantic feature ${f.id} lies outside the Environment.` });
  });
export type EnvironmentContent = z.infer<typeof environmentContentSchema>;
export const environmentVersionSchema = z.strictObject({
  reference: environmentReferenceSchema,
  content: environmentContentSchema,
});
export type EnvironmentVersion = z.infer<typeof environmentVersionSchema>;
export type EnvironmentRecord = {
  id: string;
  ownerAccountId: string | null;
  builtin: boolean;
  readOnly?: boolean;
  current: EnvironmentVersion;
  versions: EnvironmentVersion[];
};

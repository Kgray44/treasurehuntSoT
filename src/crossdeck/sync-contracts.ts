import { z } from "zod";

const id = z.string().min(1).max(191);
export const objectRefSchema = z.strictObject({
  family: z.enum(["MAP", "NOTE", "ARTIFACT"]),
  objectId: id,
  version: id,
});
export type ObjectRef = z.infer<typeof objectRefSchema>;
// Semantic continuity only. No content, credentials, draft text, coordinates of the person or raw sensors.
export const continuitySchema = z.strictObject({
  blockId: id.optional(),
  readingPosition: z.number().min(0).max(1).optional(),
  mapId: id.optional(),
  worldspaceId: id.optional(),
  regionId: id.optional(),
  selectedMarkerId: id.optional(),
  activeRouteId: id.optional(),
  annotationContextId: id.optional(),
  zoomClass: z.enum(["REGION", "LOCAL", "DETAIL"]).optional(),
  camera: z
    .strictObject({
      center: z.tuple([z.number().finite(), z.number().finite()]),
      zoom: z.number().min(0).max(24),
      bearing: z.number().min(-360).max(360),
    })
    .optional(),
  toolMode: z.enum(["READ", "CHART", "INSPECT"]).optional(),
});
export type Continuity = z.infer<typeof continuitySchema>;
export const modes = ["MOVE_FOCUS", "MOVE_CUSTODY", "MIRROR", "OPEN_COMPANION", "PIN_TO_SURFACE", "SEND_VIEW"] as const;
export type TransferMode = (typeof modes)[number];
const transferSchema = z.strictObject({
  action: z.literal("send"),
  targetId: z.string().uuid(),
  object: objectRefSchema,
  context: continuitySchema,
  mode: z.enum(modes),
  privateConfirmed: z.boolean().default(false),
});
export const commandSchema = z.strictObject({
  messageId: z.string().uuid(),
  surfaceId: z.string().uuid(),
  voyageId: id,
  sequence: z.number().int().positive(),
  payloadSchemaVersion: z.literal(1),
  // Server binds actor/session and server timestamps. Browser clocks never arbitrate custody.
  payload: z.discriminatedUnion("action", [
    transferSchema,
    z.strictObject({ action: z.enum(["accept", "acknowledge", "cancel"]), handoffId: z.string().uuid() }),
    z.strictObject({ action: z.literal("recover"), object: objectRefSchema }),
    z.strictObject({
      action: z.literal("update"),
      object: objectRefSchema,
      context: continuitySchema,
      expectedRevision: z.number().int().nonnegative(),
    }),
    z.strictObject({ action: z.literal("focus"), family: objectRefSchema.shape.family, targetId: z.string().uuid() }),
    z.strictObject({ action: z.literal("close"), object: objectRefSchema }),
  ]),
});
export type SyncCommand = z.infer<typeof commandSchema>;
export type Handoff = {
  id: string;
  sourceId: string;
  targetId: string;
  object: ObjectRef;
  context: Continuity;
  mode: TransferMode;
  title: string;
  visibility: "PERSONAL" | "PRIVATE" | "CREW";
  state: "OFFERED" | "COMMITTED" | "ACKNOWLEDGED" | "CANCELLED" | "EXPIRED";
  requestedAt: string;
  expiresAt: string;
  committedAt?: string;
  acknowledgedAt?: string;
};
export type Presentation = {
  object: ObjectRef;
  title: string;
  visibility: Handoff["visibility"];
  custody: string;
  focus: string;
  context: Continuity;
  views: Record<string, TransferMode>;
  snapshots?: Record<string, Continuity>;
  revision: number;
};
export type DeckState = {
  version: 1;
  focus: Partial<Record<ObjectRef["family"], string>>;
  objects: Record<string, Presentation>;
  handoffs: Handoff[];
  sequences: Record<string, number>;
  messages: { id: string; surfaceId: string; sequence: number; digest: string; handoffId?: string }[];
};
export type SyncSnapshot = {
  revision: number;
  nextSequence: number;
  surfaceId: string;
  voyageId: string;
  presentations: Presentation[];
  handoffs: Handoff[];
  focus: DeckState["focus"];
  observedAt: string;
};
export const objectKey = (ref: ObjectRef) => `${ref.family}:${ref.objectId}`;
export const emptyDeck = (): DeckState => ({
  version: 1,
  focus: {},
  objects: {},
  handoffs: [],
  sequences: {},
  messages: [],
});
export const HANDOFF_TTL_MS = 120_000;

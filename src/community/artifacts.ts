import { z } from "zod";
import { CommunityError } from "./domain";

/**
 * The artifact layer deliberately contains no storage, upload, or package code.
 * It validates the public, immutable metadata that Harborlight can safely pass to
 * the Sealed Hold asset pipeline and to preview clients.
 */
const artifactIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,96}$/);
const packagePathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !value.includes("\\") && !value.startsWith("/") && !/^[A-Za-z]:/.test(value), {
    message: "Artifact paths must be relative POSIX paths.",
  })
  .refine((value) => !value.split("/").some((part) => !part || part === "." || part === ".."), {
    message: "Artifact paths cannot contain traversal segments.",
  });

const descriptionSchema = z.string().trim().min(1).max(2_000);
const imageMediaTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);
const finiteNumber = z.number().finite();
const dimensionsSchema = z
  .object({ width: z.number().int().min(64).max(16_384), height: z.number().int().min(64).max(16_384) })
  .strict();
const boundsSchema = z
  .object({
    min: z.object({ x: finiteNumber, y: finiteNumber, z: finiteNumber }).strict(),
    max: z.object({ x: finiteNumber, y: finiteNumber, z: finiteNumber }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const axis of ["x", "y", "z"] as const) {
      if (value.min[axis] >= value.max[axis])
        context.addIssue({
          code: "custom",
          path: ["max", axis],
          message: `Bounds max.${axis} must exceed min.${axis}.`,
        });
      if (value.max[axis] - value.min[axis] > 100_000)
        context.addIssue({
          code: "custom",
          path: ["max", axis],
          message: "Artifact bounds exceed the permitted extent.",
        });
    }
  });

export const artifactLicenseSchema = z
  .object({
    key: z.enum(["ALL_RIGHTS_RESERVED", "CC_BY_4_0", "CC_BY_SA_4_0", "CC_BY_NC_4_0", "CC_BY_NC_SA_4_0", "CUSTOM"]),
    allowsRemix: z.boolean(),
    allowsCommercialUse: z.boolean(),
    requiresAttribution: z.boolean(),
    requiresShareAlike: z.boolean(),
  })
  .strict();
export type ArtifactLicense = z.infer<typeof artifactLicenseSchema>;

const artifactBaseSchema = z
  .object({
    id: artifactIdSchema,
    title: z.string().trim().min(1).max(140),
    description: descriptionSchema,
    license: artifactLicenseSchema,
  })
  .strict();

export const artifact2DMetadataSchema = artifactBaseSchema.extend({
  kind: z.literal("ARTIFACT_2D"),
  image: z.object({ path: packagePathSchema, mediaType: imageMediaTypeSchema, dimensions: dimensionsSchema }).strict(),
  accessibility: z.object({ description: descriptionSchema }).strict(),
});
export type Artifact2DMetadata = z.infer<typeof artifact2DMetadataSchema>;

export const artifact3DMetadataSchema = artifactBaseSchema.extend({
  kind: z.literal("ARTIFACT_3D"),
  model: z.object({ path: packagePathSchema, mediaType: z.literal("model/gltf-binary") }).strict(),
  poster: z.object({ path: packagePathSchema, mediaType: imageMediaTypeSchema, dimensions: dimensionsSchema }).strict(),
  accessibility: z.object({ description: descriptionSchema }).strict(),
  bounds: boundsSchema,
});
export type Artifact3DMetadata = z.infer<typeof artifact3DMetadataSchema>;
export type ArtifactMetadata = Artifact2DMetadata | Artifact3DMetadata;

export const DEFAULT_GLB_BUDGETS = Object.freeze({
  maxBytes: 64 * 1024 * 1024,
  maxTriangles: 250_000,
  maxTextures: 32,
  maxMeshes: 128,
  maxAccessors: 4_096,
});
export type GlbBudgets = Partial<Record<keyof typeof DEFAULT_GLB_BUDGETS, number>>;
export type GlbInspection = Readonly<{
  byteLength: number;
  meshCount: number;
  triangleCount: number;
  textureCount: number;
}>;

type GltfAccessor = { count?: unknown; type?: unknown };
type GltfPrimitive = { attributes?: unknown; indices?: unknown; mode?: unknown };
type GltfMesh = { primitives?: unknown };
type GltfRoot = {
  asset?: { version?: unknown };
  accessors?: GltfAccessor[];
  buffers?: Array<{ uri?: unknown; byteLength?: unknown }>;
  bufferViews?: Array<{ buffer?: unknown; byteOffset?: unknown; byteLength?: unknown }>;
  images?: Array<{ uri?: unknown; bufferView?: unknown; mimeType?: unknown }>;
  meshes?: GltfMesh[];
  textures?: unknown[];
};

function glbError(message: string): never {
  throw new CommunityError("COMMUNITY_GLB_INVALID", message);
}
function nonNegativeInteger(value: unknown, message: string) {
  if (!Number.isInteger(value) || (value as number) < 0) glbError(message);
  return value as number;
}
function primitiveTriangleCount(primitive: GltfPrimitive, accessors: readonly GltfAccessor[]) {
  const mode = primitive.mode === undefined ? 4 : nonNegativeInteger(primitive.mode, "GLB primitive mode is invalid.");
  if (![4, 5, 6].includes(mode)) glbError("GLB includes a non-triangle primitive.");
  if (!primitive.attributes || typeof primitive.attributes !== "object")
    glbError("GLB primitive is missing attributes.");
  const position = (primitive.attributes as Record<string, unknown>).POSITION;
  const accessorIndex = primitive.indices === undefined ? position : primitive.indices;
  const accessor = accessors[nonNegativeInteger(accessorIndex, "GLB primitive accessor is invalid.")];
  if (!accessor) glbError("GLB primitive references a missing accessor.");
  const count = nonNegativeInteger(accessor.count, "GLB accessor count is invalid.");
  if (mode === 4 && count % 3 !== 0) glbError("GLB triangle primitive count must be divisible by three.");
  return mode === 4 ? count / 3 : Math.max(0, count - 2);
}

/** Validate a GLB container and its glTF 2.0 resource graph without rendering it. */
export function inspectGlb(bytes: Uint8Array, overrides: GlbBudgets = {}): GlbInspection {
  const budgets = { ...DEFAULT_GLB_BUDGETS, ...overrides };
  if (bytes.byteLength > budgets.maxBytes) glbError("GLB exceeds the permitted byte budget.");
  if (bytes.byteLength < 20) glbError("GLB is too short.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    glbError("GLB header is invalid.");
  let offset = 12;
  let jsonChunk: Uint8Array | undefined;
  let binChunk: Uint8Array | undefined;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) glbError("GLB chunk header is truncated.");
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || offset + chunkLength > bytes.byteLength) glbError("GLB chunk length is invalid.");
    if (chunkType === 0x4e4f534a) {
      if (chunkIndex !== 0 || jsonChunk) glbError("GLB must contain one leading JSON chunk.");
      jsonChunk = bytes.slice(offset, offset + chunkLength);
    } else if (chunkType === 0x004e4942) {
      if (!jsonChunk || binChunk) glbError("GLB can contain at most one BIN chunk after JSON.");
      binChunk = bytes.slice(offset, offset + chunkLength);
    } else glbError("GLB contains an unsupported chunk.");
    offset += chunkLength;
    chunkIndex += 1;
  }
  if (!jsonChunk || offset !== bytes.byteLength) glbError("GLB JSON chunk is missing.");
  let root: GltfRoot;
  try {
    root = JSON.parse(new TextDecoder().decode(jsonChunk).trim()) as GltfRoot;
  } catch {
    glbError("GLB JSON is malformed.");
  }
  if (!root || typeof root !== "object" || root.asset?.version !== "2.0")
    glbError("GLB must declare glTF asset version 2.0.");
  const accessors = Array.isArray(root.accessors) ? root.accessors : [];
  const buffers = Array.isArray(root.buffers) ? root.buffers : [];
  const bufferViews = Array.isArray(root.bufferViews) ? root.bufferViews : [];
  const meshes = Array.isArray(root.meshes) ? root.meshes : [];
  const textures = Array.isArray(root.textures) ? root.textures : [];
  if (!meshes.length) glbError("GLB must contain at least one mesh.");
  if (
    meshes.length > budgets.maxMeshes ||
    accessors.length > budgets.maxAccessors ||
    textures.length > budgets.maxTextures
  )
    glbError("GLB exceeds the permitted resource budget.");
  if (buffers.length > 1) glbError("GLB may contain only the embedded binary buffer.");
  for (const buffer of buffers) {
    if (!buffer || typeof buffer !== "object" || "uri" in buffer) glbError("GLB cannot reference external buffers.");
    const byteLength = nonNegativeInteger(buffer.byteLength, "GLB buffer byte length is invalid.");
    if (!binChunk || byteLength > binChunk.byteLength) glbError("GLB embedded buffer is missing or truncated.");
  }
  for (const bufferView of bufferViews) {
    if (
      !bufferView ||
      typeof bufferView !== "object" ||
      nonNegativeInteger(bufferView.buffer, "GLB buffer view buffer is invalid.") !== 0
    )
      glbError("GLB buffer view must reference the embedded buffer.");
    const byteOffset =
      bufferView.byteOffset === undefined
        ? 0
        : nonNegativeInteger(bufferView.byteOffset, "GLB buffer view offset is invalid.");
    const byteLength = nonNegativeInteger(bufferView.byteLength, "GLB buffer view length is invalid.");
    if (!binChunk || byteOffset + byteLength > binChunk.byteLength)
      glbError("GLB buffer view exceeds the embedded buffer.");
  }
  for (const accessor of accessors) {
    const bufferView = (accessor as { bufferView?: unknown }).bufferView;
    if (
      bufferView === undefined ||
      !bufferViews[nonNegativeInteger(bufferView, "GLB accessor buffer view is invalid.")]
    )
      glbError("GLB accessor references a missing buffer view.");
  }
  for (const image of Array.isArray(root.images) ? root.images : []) {
    if (
      !image ||
      typeof image !== "object" ||
      "uri" in image ||
      !bufferViews[nonNegativeInteger(image.bufferView, "GLB image buffer view is invalid.")]
    )
      glbError("GLB images must be embedded buffer views without URI references.");
  }
  let triangleCount = 0;
  for (const mesh of meshes) {
    if (!mesh || !Array.isArray(mesh.primitives) || !mesh.primitives.length) glbError("GLB mesh has no primitives.");
    for (const primitive of mesh.primitives) {
      triangleCount += primitiveTriangleCount(primitive as GltfPrimitive, accessors);
      if (triangleCount > budgets.maxTriangles) glbError("GLB exceeds the permitted triangle budget.");
    }
  }
  return Object.freeze({
    byteLength: bytes.byteLength,
    meshCount: meshes.length,
    triangleCount,
    textureCount: textures.length,
  });
}

export function validateArtifact2D(metadata: unknown): Artifact2DMetadata {
  return artifact2DMetadataSchema.parse(metadata);
}
export function validateArtifact3D(metadata: unknown, glb: Uint8Array, budgets?: GlbBudgets): Artifact3DMetadata {
  const parsed = artifact3DMetadataSchema.parse(metadata);
  inspectGlb(glb, budgets);
  return parsed;
}

const componentSchema = z
  .object({
    artifactId: artifactIdSchema,
    transform: z
      .object({
        position: z.tuple([finiteNumber, finiteNumber, finiteNumber]),
        rotationDegrees: z.tuple([finiteNumber, finiteNumber, finiteNumber]),
        scale: z.tuple([finiteNumber.positive(), finiteNumber.positive(), finiteNumber.positive()]),
      })
      .strict(),
  })
  .strict();
const aggregateBaseSchema = artifactBaseSchema.extend({ itemIds: z.array(artifactIdSchema).min(1).max(128) });
export const artifactCollectionSchema = aggregateBaseSchema.extend({ kind: z.literal("ARTIFACT_COLLECTION") });
export const artifactAssemblySchema = artifactBaseSchema.extend({
  kind: z.literal("ARTIFACT_ASSEMBLY"),
  components: z.array(componentSchema).min(1).max(128),
});
export type ArtifactCollection = z.infer<typeof artifactCollectionSchema>;
export type ArtifactAssembly = z.infer<typeof artifactAssemblySchema>;
export type ArtifactNode = ArtifactMetadata | ArtifactCollection | ArtifactAssembly;

function assertCompatibleLicense(container: ArtifactLicense, component: ArtifactLicense) {
  if (!component.allowsRemix)
    throw new CommunityError(
      "COMMUNITY_ARTIFACT_LICENSE_INCOMPATIBLE",
      "A component license does not permit remixing.",
    );
  if (!component.allowsCommercialUse && container.allowsCommercialUse)
    throw new CommunityError("COMMUNITY_ARTIFACT_LICENSE_INCOMPATIBLE", "A component forbids commercial reuse.");
  if (component.requiresAttribution && !container.requiresAttribution)
    throw new CommunityError("COMMUNITY_ARTIFACT_LICENSE_INCOMPATIBLE", "A component requires attribution.");
  if (component.requiresShareAlike && !container.requiresShareAlike)
    throw new CommunityError("COMMUNITY_ARTIFACT_LICENSE_INCOMPATIBLE", "A component requires share-alike licensing.");
}

/** Validate aggregate references, cycles, duplicate members, and licence propagation. */
export function validateArtifactGraph(nodes: readonly unknown[]): ArtifactNode[] {
  const parsed = nodes.map((node) => {
    const kind = (node as { kind?: unknown } | null)?.kind;
    if (kind === "ARTIFACT_2D") return artifact2DMetadataSchema.parse(node);
    if (kind === "ARTIFACT_3D") return artifact3DMetadataSchema.parse(node);
    if (kind === "ARTIFACT_COLLECTION") return artifactCollectionSchema.parse(node);
    if (kind === "ARTIFACT_ASSEMBLY") return artifactAssemblySchema.parse(node);
    throw new CommunityError("COMMUNITY_ARTIFACT_INVALID", "Artifact kind is not supported.");
  });
  const byId = new Map<string, ArtifactNode>();
  for (const node of parsed) {
    if (byId.has(node.id)) throw new CommunityError("COMMUNITY_ARTIFACT_DUPLICATE", "Artifact IDs must be unique.");
    byId.set(node.id, node);
  }
  const visiting = new Set<string>();
  const validated = new Set<string>();
  const visit = (id: string): ArtifactNode => {
    if (visiting.has(id))
      throw new CommunityError(
        "COMMUNITY_ARTIFACT_RECURSIVE",
        "Artifact collections and assemblies cannot be recursive.",
      );
    const node = byId.get(id);
    if (!node) throw new CommunityError("COMMUNITY_ARTIFACT_COMPONENT_MISSING", "An artifact component is missing.");
    if (validated.has(id)) return node;
    visiting.add(id);
    const references =
      node.kind === "ARTIFACT_COLLECTION"
        ? node.itemIds
        : node.kind === "ARTIFACT_ASSEMBLY"
          ? node.components.map((component) => component.artifactId)
          : [];
    if (new Set(references).size !== references.length)
      throw new CommunityError(
        "COMMUNITY_ARTIFACT_DUPLICATE_COMPONENT",
        "Artifact collections and assemblies cannot repeat a component.",
      );
    for (const reference of references) assertCompatibleLicense(node.license, visit(reference).license);
    visiting.delete(id);
    validated.add(id);
    return node;
  };
  parsed.forEach((node) => visit(node.id));
  return parsed;
}

export const artifactPreviewContractSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ARTIFACT_2D"),
      imagePath: packagePathSchema,
      altText: descriptionSchema,
      reducedMotion: z.literal("STATIC_IMAGE"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ARTIFACT_3D"),
      modelPath: packagePathSchema,
      posterPath: packagePathSchema,
      textDescription: descriptionSchema,
      keyboard: z
        .object({
          rotate: z.literal("ArrowLeft/ArrowRight"),
          zoom: z.literal("ArrowUp/ArrowDown"),
          reset: z.literal("Home"),
          pauseAutoRotate: z.literal("Space"),
        })
        .strict(),
      reducedMotion: z.literal("STATIC_POSTER"),
      autoRotate: z.boolean(),
    })
    .strict(),
]);
export type ArtifactPreviewContract = z.infer<typeof artifactPreviewContractSchema>;

export function createArtifactPreviewContract(
  metadata: ArtifactMetadata,
  prefersReducedMotion = false,
): ArtifactPreviewContract {
  if (metadata.kind === "ARTIFACT_2D")
    return {
      kind: "ARTIFACT_2D",
      imagePath: metadata.image.path,
      altText: metadata.accessibility.description,
      reducedMotion: "STATIC_IMAGE",
    };
  return {
    kind: "ARTIFACT_3D",
    modelPath: metadata.model.path,
    posterPath: metadata.poster.path,
    textDescription: metadata.accessibility.description,
    keyboard: { rotate: "ArrowLeft/ArrowRight", zoom: "ArrowUp/ArrowDown", reset: "Home", pauseAutoRotate: "Space" },
    reducedMotion: "STATIC_POSTER",
    autoRotate: !prefersReducedMotion,
  };
}

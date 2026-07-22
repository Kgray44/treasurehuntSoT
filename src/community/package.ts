import { createHash } from "node:crypto";
import { z } from "zod";
import { CommunityError, stableJson } from "./domain";

const MAX_FILES = 256;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const executableExtensions = /\.(?:exe|dll|bat|cmd|ps1|sh|js|mjs|cjs|html?|svg)$/i;
const safeMediaTypes = new Set(["application/json", "image/png", "image/jpeg", "image/webp", "model/gltf-binary"]);

export const packageItemSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._-]{1,96}$/),
    type: z.enum([
      "CHRONICLE",
      "CHRONICLE_TEMPLATE",
      "STORY_BLOCK_PRESET",
      "ARTIFACT_2D",
      "ARTIFACT_3D",
      "ARTIFACT_COLLECTION",
      "ARTIFACT_ASSEMBLY",
    ]),
    path: z.string().min(1).max(240),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    mediaType: z.string().max(128),
    byteLength: z.number().int().min(0).max(MAX_FILE_BYTES),
    dependencies: z.array(z.string()).max(64).default([]),
    accessibility: z
      .object({ description: z.string().trim().min(1).max(1000), posterPath: z.string().optional() })
      .strict()
      .optional(),
  })
  .strict();
export type CommunityPackageItem = z.infer<typeof packageItemSchema>;
export const communityPackageManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageId: z.string().min(1).max(128),
    releaseId: z.string().min(1),
    semanticVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    minimumPlatformVersion: z.string().optional(),
    license: z.object({ key: z.string().min(1), version: z.number().int().positive() }).strict(),
    attribution: z.array(z.object({ displayName: z.string().min(1), contributionType: z.string().min(1) }).strict()),
    items: z.array(packageItemSchema).min(1).max(MAX_FILES),
  })
  .strict();
export type CommunityPackageManifest = z.infer<typeof communityPackageManifestSchema>;
export type CommunityPackageFile = { path: string; mediaType: string; bytes: Uint8Array };

export function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function assertPackagePath(value: string) {
  if (!value || value.length > 240 || value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value))
    throw new CommunityError("COMMUNITY_PACKAGE_UNSAFE_PATH", "Package paths must be relative POSIX paths.");
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f]/u.test(part)))
    throw new CommunityError("COMMUNITY_PACKAGE_UNSAFE_PATH", "Package path contains traversal or an unsafe segment.");
}
function assertGlb(bytes: Uint8Array) {
  if (bytes.byteLength < 20) throw new CommunityError("COMMUNITY_GLB_INVALID", "GLB is too short.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new CommunityError("COMMUNITY_GLB_INVALID", "GLB header is invalid.");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength)
    throw new CommunityError("COMMUNITY_GLB_INVALID", "GLB JSON chunk is missing.");
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)).trim()) as Record<string, unknown>;
  } catch {
    throw new CommunityError("COMMUNITY_GLB_INVALID", "GLB JSON is malformed.");
  }
  if (!Array.isArray(json.meshes) || json.meshes.length === 0 || JSON.stringify(json).includes('"uri"'))
    throw new CommunityError(
      "COMMUNITY_GLB_INVALID",
      "GLB needs an embedded mesh and cannot reference external resources.",
    );
}
function assertItem(item: CommunityPackageItem) {
  assertPackagePath(item.path);
  if (executableExtensions.test(item.path) || !safeMediaTypes.has(item.mediaType))
    throw new CommunityError(
      "COMMUNITY_PACKAGE_FORBIDDEN_CONTENT",
      "Executable or unsupported package content is forbidden.",
    );
  if ((item.type === "ARTIFACT_2D" || item.type === "ARTIFACT_3D") && !item.accessibility)
    throw new CommunityError("COMMUNITY_ACCESSIBILITY_REQUIRED", "Artifacts require an accessible description.");
  if (item.type === "ARTIFACT_3D" && (!item.accessibility?.posterPath || item.mediaType !== "model/gltf-binary"))
    throw new CommunityError("COMMUNITY_3D_FALLBACK_REQUIRED", "3D artifacts require a GLB poster fallback.");
}
export function assertDependencyGraph(items: readonly CommunityPackageItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new CommunityError("COMMUNITY_DEPENDENCY_CYCLE", "Package dependencies contain a cycle.");
    if (visited.has(id)) return;
    const item = byId.get(id);
    if (!item) throw new CommunityError("COMMUNITY_DEPENDENCY_MISSING", "Package dependency is missing.");
    visiting.add(id);
    item.dependencies.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  items.forEach((item) => visit(item.id));
}
export function packageChecksum(manifest: CommunityPackageManifest) {
  return sha256(stableJson(communityPackageManifestSchema.parse(manifest)));
}
export function verifyCommunityPackage(rawManifest: unknown, files: readonly CommunityPackageFile[]) {
  const manifest = communityPackageManifestSchema.parse(rawManifest);
  const normalized = new Set<string>();
  let size = 0;
  for (const file of files) {
    assertPackagePath(file.path);
    const key = file.path.toLocaleLowerCase("en-US");
    if (normalized.has(key))
      throw new CommunityError("COMMUNITY_PACKAGE_DUPLICATE_PATH", "Package contains duplicate normalized paths.");
    normalized.add(key);
    size += file.bytes.byteLength;
    if (file.bytes.byteLength > MAX_FILE_BYTES || size > MAX_PACKAGE_BYTES)
      throw new CommunityError("COMMUNITY_PACKAGE_LIMIT", "Package exceeds permitted size.");
    if (executableExtensions.test(file.path) || !safeMediaTypes.has(file.mediaType))
      throw new CommunityError("COMMUNITY_PACKAGE_FORBIDDEN_CONTENT", "Package contains forbidden content.");
    if (file.mediaType === "model/gltf-binary") assertGlb(file.bytes);
  }
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  if (fileByPath.size !== manifest.items.length)
    throw new CommunityError("COMMUNITY_PACKAGE_EXTRA_FILE", "Each package file must be declared exactly once.");
  for (const item of manifest.items) {
    assertItem(item);
    const file = fileByPath.get(item.path);
    if (!file) throw new CommunityError("COMMUNITY_PACKAGE_MISSING_FILE", "Package is missing a declared file.");
    if (
      file.bytes.byteLength !== item.byteLength ||
      file.mediaType !== item.mediaType ||
      sha256(file.bytes) !== item.checksum
    )
      throw new CommunityError(
        "COMMUNITY_PACKAGE_CHECKSUM_MISMATCH",
        "Package file checksum or metadata does not match its declaration.",
      );
  }
  assertDependencyGraph(manifest.items);
  return { manifest, checksum: packageChecksum(manifest), byteLength: size };
}

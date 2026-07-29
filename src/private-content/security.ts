import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PRIVATE_SENTINEL } from "./core";

const forbiddenPath = [
  /\.ftprivate$/i,
  /\.ftkey$/i,
  /(^|[\\/])(?:private-content|private-exports|decrypted-private-content)([\\/]|$)/i,
];
const forbiddenContent = [/aws_secret_access_key\s*=\s*\S+/i, new RegExp(PRIVATE_SENTINEL)];
const pemPrivateKey =
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----\s*(?:[A-Za-z0-9+/]{20,}={0,2}\s*)+-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/m;
const archivePolicyRelativePath = "Codex_Chats/governed-private-content-archives.json";
const governedArchivePath = /^Codex_Chats\/chats\/[0-9a-f-]{36}--[a-z0-9-]+\.md$/i;

type ScanClassification =
  | "active-violation"
  | "governed-historical-archive"
  | "synthetic-fixture"
  | "ignored-generated-output";

type ScanHit = { path: string; rule: string };
type ArchivePolicyEntry = {
  path: string;
  archiveSha256: string;
  manifestContentSha256: string;
  classification: "historical-synthetic-prompt-sentinel";
};
type PrivateContentScanReport = {
  violations: ScanHit[];
  classifications: Array<{ path: string; classification: ScanClassification }>;
};

function relativePath(root: string, file: string) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadArchivePolicy(
  root: string,
): Promise<{ entries: Map<string, ArchivePolicyEntry>; violations: ScanHit[] }> {
  const policyPath = path.join(root, archivePolicyRelativePath);
  let policyText: string;
  try {
    policyText = await readFile(policyPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: new Map(), violations: [] };
    return {
      entries: new Map(),
      violations: [{ path: archivePolicyRelativePath, rule: "invalid-governed-archive-policy" }],
    };
  }
  try {
    const parsed = JSON.parse(policyText) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { archives?: unknown }).archives)) {
      throw new Error("archives array is required");
    }
    const manifest = JSON.parse(await readFile(path.join(root, "Codex_Chats/manifest.json"), "utf8")) as {
      conversations?: Array<{ archive_path?: unknown; content_sha256?: unknown }>;
    };
    if (!Array.isArray(manifest.conversations)) throw new Error("archive manifest conversations are required");
    const manifestHashes = new Map(
      manifest.conversations
        .filter(
          (entry): entry is { archive_path: string; content_sha256: string } =>
            typeof entry.archive_path === "string" && typeof entry.content_sha256 === "string",
        )
        .map((entry) => [entry.archive_path, entry.content_sha256]),
    );
    const entries = new Map<string, ArchivePolicyEntry>();
    for (const candidate of (parsed as { archives: unknown[] }).archives) {
      if (!candidate || typeof candidate !== "object") throw new Error("archive entry must be an object");
      const entry = candidate as Partial<ArchivePolicyEntry>;
      if (
        typeof entry.path !== "string" ||
        !governedArchivePath.test(entry.path) ||
        typeof entry.archiveSha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(entry.archiveSha256) ||
        typeof entry.manifestContentSha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(entry.manifestContentSha256) ||
        entry.classification !== "historical-synthetic-prompt-sentinel" ||
        entries.has(entry.path) ||
        manifestHashes.get(entry.path) !== entry.manifestContentSha256
      ) {
        throw new Error("archive policy entry is not an exact governed transcript record");
      }
      entries.set(entry.path, entry as ArchivePolicyEntry);
    }
    return { entries, violations: [] };
  } catch {
    return {
      entries: new Map(),
      violations: [{ path: archivePolicyRelativePath, rule: "invalid-governed-archive-policy" }],
    };
  }
}

async function walk(
  root: string,
  files: string[] = [],
  ignoredGenerated: string[] = [],
): Promise<{ files: string[]; ignoredGenerated: string[] }> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next"].includes(entry.name) || entry.name.startsWith(".sealed-build")) {
      if (entry.name === ".next" || entry.name.startsWith(".sealed-build")) ignoredGenerated.push(entry.name);
      continue;
    }
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) await walk(candidate, files, ignoredGenerated);
    else files.push(candidate);
  }
  return { files, ignoredGenerated };
}

export async function scanPrivateContentReport(root = process.cwd()): Promise<PrivateContentScanReport> {
  const { entries: governedArchives, violations } = await loadArchivePolicy(root);
  const { files, ignoredGenerated } = await walk(root);
  const classifications: PrivateContentScanReport["classifications"] = ignoredGenerated.map((entry) => ({
    path: entry,
    classification: "ignored-generated-output",
  }));
  for (const file of files) {
    const relative = relativePath(root, file);
    const implementationFile = /^(src|scripts|tests)[\\/].*private-content[\\/]/.test(relative);
    const nameRule = implementationFile ? undefined : forbiddenPath.find((rule) => rule.test(relative));
    if (nameRule) {
      violations.push({ path: relative, rule: "forbidden-path" });
      classifications.push({ path: relative, classification: "active-violation" });
      continue;
    }
    if (/\.(?:ts|tsx|js|json|md|env|txt)$/i.test(file)) {
      const text = await readFile(file, "utf8");
      const sentinelAllowed =
        /^(src|scripts|tests)[\\/].*private-content[\\/]|^Development_Docs[\\/]Private_Content_Test_Plan\.md$/.test(
          relative,
        );
      const nonWaivableSecret = pemPrivateKey.test(text) || forbiddenContent[0].test(text);
      const hasSyntheticSentinel = text.includes(PRIVATE_SENTINEL);
      if (nonWaivableSecret) {
        violations.push({ path: relative, rule: "sensitive-content" });
        classifications.push({ path: relative, classification: "active-violation" });
      } else if (hasSyntheticSentinel && sentinelAllowed) {
        classifications.push({ path: relative, classification: "synthetic-fixture" });
      } else if (hasSyntheticSentinel && governedArchives.get(relative)?.archiveSha256 === sha256(text)) {
        classifications.push({ path: relative, classification: "governed-historical-archive" });
      } else if (hasSyntheticSentinel) {
        violations.push({ path: relative, rule: "sensitive-content" });
        classifications.push({ path: relative, classification: "active-violation" });
      }
    }
  }
  return { violations, classifications };
}

export async function scanPrivateContent(root = process.cwd()) {
  return (await scanPrivateContentReport(root)).violations;
}
export async function scanBuildOutput(
  root = process.env.NEXT_DIST_DIR
    ? path.resolve(process.cwd(), process.env.NEXT_DIST_DIR, "static")
    : path.join(process.cwd(), ".next", "static"),
) {
  try {
    const hits: Array<{ path: string; rule: string }> = [];
    const { files } = await walk(root);
    for (const file of files) {
      if (!/\.(?:js|map|html|json)$/i.test(file)) continue;
      const text = await readFile(file, "utf8");
      if (text.includes(PRIVATE_SENTINEL) || pemPrivateKey.test(text))
        hits.push({ path: path.relative(root, file), rule: "public-build-leak" });
    }
    return hits;
  } catch {
    return [];
  }
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { featureCatalogEntrySchema, type FeatureCatalogEntry } from "./catalog-schema";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const catalogRoot = path.join(repositoryRoot, "Development_Docs", "Features");
export const fragmentRoot = path.join(catalogRoot, "catalog");
export const branchFragmentRoot = path.join(catalogRoot, "branch-complete");

export const exclusionNotes = [
  "Harborlight Phase 4 is planned and is not cataloged as an implemented capability.",
  "Project Sounding Line's local governance and verification control plane is cataloged, and its focused hosted workflow has passed; remote workers, provider/MySQL proof, production signing, branch protection, and the P34 browser matrix remain separate non-pass work.",
  "Project Landfall is governed but not implemented.",
  "Vision Waypoint recognition is not implemented beyond its provider seam and simulator.",
  "Production multi-instance pub/sub, distributed rate limiting, production scanner/KMS/storage/alerting, and full deployment proof remain separate work.",
  "Real private Chronicle story material is intentionally absent from the public repository.",
];

function jsonFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function loadFeatureCatalog(root = catalogRoot): { entries: FeatureCatalogEntry[]; files: string[] } {
  const files = [...jsonFiles(path.join(root, "catalog")), ...jsonFiles(path.join(root, "branch-complete"))];
  const entries: FeatureCatalogEntry[] = [];
  for (const file of files) {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) entries.push(featureCatalogEntrySchema.parse(candidate));
  }
  return { entries, files };
}

export function sortedEntries(entries: FeatureCatalogEntry[]): FeatureCatalogEntry[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

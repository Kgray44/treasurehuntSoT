import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { promisify } from "node:util";
import type { DiscoveryBranch, DiscoveryDocument } from "./discovery.js";

const execFileAsync = promisify(execFile);
const maxDocumentCount = 500;
const maxDocumentBytes = 256 * 1024;

interface DocumentIndexRecord {
  path?: unknown;
  record_type?: unknown;
  status?: unknown;
}

interface DocumentIndex {
  records?: unknown;
}

export function documentedDiscoveryPaths(index: DocumentIndex): string[] {
  if (!Array.isArray(index.records)) return [];
  return index.records
    .flatMap((value): string[] => {
      const record = value as DocumentIndexRecord;
      const path = record.path;
      if (typeof path !== "string") return [];
      if (!path.startsWith("Development_Docs/")) return [];
      if (
        String(record.status ?? "")
          .toLowerCase()
          .includes("archiv")
      )
        return [];
      return /\.(?:md|json|txt)$/iu.test(path) ? [path] : [];
    })
    .filter((path, index, values) => values.indexOf(path) === index)
    .slice(0, maxDocumentCount);
}

export function parseReadOnlyGitRefs(output: string): DiscoveryBranch[] {
  return output.split(/\r?\n/iu).flatMap((line) => {
    const [name, headSha] = line.split("\t");
    if (!name || !headSha || !/^[A-Fa-f0-9]{7,64}$/u.test(headSha)) return [];
    return [{ name, headSha }];
  });
}

interface CachedDocument {
  signature: string;
  text: string;
}

interface CollectedDocuments {
  values: DiscoveryDocument[];
  available: boolean;
}

interface CollectedBranches {
  values: DiscoveryBranch[];
  available: boolean;
}

/**
 * Reads only bounded, machine-indexed documentation and a fixed Git ref query.
 * It accepts no caller-provided command or repository path from browser input.
 */
export class RepositoryEvidenceCollector {
  private readonly cache = new Map<string, CachedDocument>();

  constructor(
    private readonly repositoryRoot: string,
    private readonly timeoutMs: number,
  ) {}

  async refresh(): Promise<{
    documents: DiscoveryDocument[];
    branches: DiscoveryBranch[];
    documentsAvailable: boolean;
    branchesAvailable: boolean;
    documentCount: number;
    branchCount: number;
  }> {
    const documents = await this.documents();
    const branches = await this.branches();
    return {
      documents: documents.values,
      branches: branches.values,
      documentsAvailable: documents.available,
      branchesAvailable: branches.available,
      documentCount: documents.values.length,
      branchCount: branches.values.length,
    };
  }

  private async documents(): Promise<CollectedDocuments> {
    const indexPath = resolve(this.repositoryRoot, "Development_Docs/document-index.json");
    let index: DocumentIndex;
    try {
      index = JSON.parse(await readFile(indexPath, "utf8")) as DocumentIndex;
    } catch {
      return { values: [], available: false };
    }
    const documents: DiscoveryDocument[] = [];
    for (const documentPath of documentedDiscoveryPaths(index)) {
      const absolute = resolve(this.repositoryRoot, documentPath);
      const pathFromRoot = relative(this.repositoryRoot, absolute);
      if (!pathFromRoot || pathFromRoot.startsWith("..") || /^[A-Za-z]:/u.test(pathFromRoot)) continue;
      try {
        const metadata = await stat(absolute);
        if (!metadata.isFile() || metadata.size > maxDocumentBytes) continue;
        const signature = `${metadata.size}:${metadata.mtimeMs}`;
        const cached = this.cache.get(documentPath);
        const text = cached?.signature === signature ? cached.text : await readFile(absolute, "utf8");
        this.cache.set(documentPath, { signature, text });
        documents.push({ path: documentPath, text });
      } catch {
        // A changed or unavailable record is a source limitation, never an exception that stops observation.
      }
    }
    return { values: documents, available: true };
  }

  private async branches(): Promise<CollectedBranches> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "-C",
          this.repositoryRoot,
          "for-each-ref",
          "--format=%(refname:short)%09%(objectname)",
          "refs/heads",
          "refs/remotes/origin",
        ],
        { timeout: this.timeoutMs, maxBuffer: 128 * 1024 },
      );
      return { values: parseReadOnlyGitRefs(stdout), available: true };
    } catch {
      return { values: [], available: false };
    }
  }
}

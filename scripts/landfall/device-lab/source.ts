import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { labTool } from "./host";

/** Bind receipts to actual inputs, including dirty and untracked development source. */
export async function deviceLabSourceIdentity(additionalPaths: string[] = []) {
  const sourceSha = (await labTool("git", ["rev-parse", "HEAD"])).trim();
  const sourceTree = (await labTool("git", ["rev-parse", "HEAD^{tree}"])).trim();
  const dirty = Boolean((await labTool("git", ["status", "--porcelain"])).trim());
  const files = (
    await labTool("git", [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "src",
      "scripts/landfall/device-lab",
      "native",
      "package-lock.json",
      "package.json",
      "prisma/schema.sqlite.prisma",
      "prisma/migrations",
      "public/landfall-offline-sw.js",
      ".agents/landfall-device-lab-hosted.yml",
      ...additionalPaths,
    ])
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of [...new Set(files)]) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(process.cwd(), file)));
    hash.update("\0");
  }
  return { sourceSha, sourceTree, dirty, sourceFingerprint: hash.digest("hex") };
}

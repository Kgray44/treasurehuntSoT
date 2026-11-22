import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repositoryRoot = process.cwd();
const homeport = "Development_Docs/Projects/Project_Homeport";

export function withInventoryWorkspace(run, { source = false, evidence = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "homeport-inventories-"));
  try {
    mkdirSync(path.dirname(path.join(root, homeport)), { recursive: true });
    cpSync(path.join(repositoryRoot, homeport), path.join(root, homeport), {
      recursive: true,
      filter: (entry) => evidence || !/\.(?:png|jpe?g|webp|webm|mp4|pdf)$/iu.test(entry),
    });
    cpSync(path.join(repositoryRoot, "testing"), path.join(root, "testing"), { recursive: true });
    cpSync(path.join(repositoryRoot, ".prettierrc.json"), path.join(root, ".prettierrc.json"));
    if (source) cpSync(path.join(repositoryRoot, "src"), path.join(root, "src"), { recursive: true });
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

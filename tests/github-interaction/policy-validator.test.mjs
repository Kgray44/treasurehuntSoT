import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateGitHubInteractionPolicy } from "../../scripts/github-interaction/policy-validate.mjs";

test("policy validator rejects unmanaged active GitHub access and ignores archived documentation", async () => {
  const root = await mkdtemp(join(tmpdir(), "fairlead-policy-"));
  try {
    await mkdir(join(root, "scripts/github-interaction"), { recursive: true });
    await mkdir(join(root, "Development_Docs/Archive"), { recursive: true });
    await writeFile(
      join(root, "scripts/github-interaction/policy-exceptions.json"),
      JSON.stringify({ approvedRoots: ["scripts/github-interaction/"], exceptions: {} }),
    );
    await writeFile(join(root, "scripts/unmanaged.mjs"), "await fetch('https://api.github.com/repos/example');");
    await writeFile(join(root, "Development_Docs/Archive/old.md"), "gh api repos/example");
    const result = await validateGitHubInteractionPolicy(root);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.violations.map((entry) => entry.file),
      ["scripts/unmanaged.mjs"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

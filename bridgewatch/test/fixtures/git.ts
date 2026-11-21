import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createGitFixture(branch: string) {
  const root = mkdtempSync(join(tmpdir(), "bridgewatch-git-"));
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init", "--initial-branch", branch);
    git(
      "-c",
      "user.name=Bridgewatch Test",
      "-c",
      "user.email=bridgewatch@example.test",
      "commit",
      "--allow-empty",
      "-m",
      "Fixture",
    );
    return {
      root,
      gitDir: join(root, ".git"),
      sourceSha: git("rev-parse", "HEAD"),
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const textExtensions = new Set([".ts", ".tsx", ".css", ".md", ".json", ".csv", ".mjs"]);
const excludedDirectories = new Set([".git", ".next", "node_modules", "Codex_Chats", "migrations", "mysql-migrations"]);
const legacyWriter =
  /\b(?:db|tx)\.(?:campaign|chapter|artifact|artifactAward|sideQuest|sideQuestObjective|progressEvent|campaignSnapshot|playerAccess|adminAuditLog|preparedAction|commandExecution|audioPreference|viewedContent|viewedCeremony|saveStateSnapshot|mapLocation|mapRoute|journalEntry|playerPresence)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/u;
const forbiddenTerm = /tall[ _-]?ta(?:le)|tall(?:tale)/iu;
const disabledLegacyWriterModule = path.join("src", "server", "progression.ts");

async function filesWithin(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...(await filesWithin(candidate)));
    else if (textExtensions.has(path.extname(entry.name))) results.push(candidate);
  }
  return results;
}

export async function validateProjectOneVoyage(root = process.cwd()) {
  const violations: string[] = [];
  const activeRoots = ["src", "docs", "Development_Docs"];
  const activeFiles = (await Promise.all(activeRoots.map((folder) => filesWithin(path.join(root, folder))))).flat();
  activeFiles.push(path.join(root, "README.md"), path.join(root, "package.json"), path.join(root, ".env.example"));
  for (const file of activeFiles) {
    const content = await readFile(file, "utf8");
    if (forbiddenTerm.test(content))
      violations.push(`${path.relative(root, file)} still uses the retired product term.`);
  }
  const sourceFiles = await filesWithin(path.join(root, "src"));
  for (const file of sourceFiles) {
    const relative = path.relative(root, file);
    const content = await readFile(file, "utf8");
    if (legacyWriter.test(content) && relative !== disabledLegacyWriterModule)
      violations.push(`${relative} contains a direct legacy persistence writer.`);
    if (relative === disabledLegacyWriterModule && !content.includes("LEGACY_WRITERS_DISABLED = true"))
      violations.push(`${relative} must explicitly declare legacy writers disabled.`);
  }
  const routeFiles = sourceFiles.filter((file) => path.relative(root, file).startsWith(path.join("src", "app", "api")));
  for (const file of routeFiles) {
    const content = await readFile(file, "utf8");
    if (content.includes("@/server/progression"))
      violations.push(`${path.relative(root, file)} imports the disabled legacy progression writer.`);
  }
  return violations;
}

async function main() {
  const violations = await validateProjectOneVoyage();
  if (violations.length) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Project One Voyage architecture validation passed.\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main();

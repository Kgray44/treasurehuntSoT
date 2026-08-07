import { spawnSync } from "node:child_process";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function prepareHomeportPhase6Database() {
  const repositoryRoot = path.resolve(process.cwd());
  const taskRoot = path.resolve(required("HOMEPORT_PHASE6_TASK_ROOT"));
  const source = path.resolve(required("HOMEPORT_PHASE6_SOURCE_DATABASE"));
  const target = path.resolve(required("HOMEPORT_PHASE6_DATABASE_PATH"));
  const evidenceRoot = path.resolve(required("HOMEPORT_PHASE6_EVIDENCE_ROOT"));
  const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
  const approvedTaskRoot = path.resolve("C:/Users/kkids/AppData/Local/Temp");
  const approvedEvidenceRoot = path.join(
    repositoryRoot,
    "Development_Docs",
    "Projects",
    "Project_Homeport",
    "evidence",
    "phase6",
  );
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size < 1) throw new Error(`HOMEPORT_PHASE6_SOURCE_DATABASE_MISSING:${source}`);
  if (!taskRoot.startsWith(approvedTaskRoot + path.sep))
    throw new Error(`HOMEPORT_PHASE6_TASK_ROOT_REFUSED:${taskRoot}`);
  if (source === canonicalDatabase || target === canonicalDatabase || source === target)
    throw new Error("HOMEPORT_PHASE6_REFUSES_CANONICAL_OR_SAME_FILE_DATABASE");
  if (!source.startsWith(taskRoot + path.sep) || !target.startsWith(taskRoot + path.sep))
    throw new Error("HOMEPORT_PHASE6_DATABASE_OUTSIDE_TASK_ROOT");
  if (evidenceRoot !== approvedEvidenceRoot) throw new Error(`HOMEPORT_PHASE6_EVIDENCE_ROOT_REFUSED:${evidenceRoot}`);

  await mkdir(path.dirname(target), { recursive: true });
  for (const ownedTarget of [target, `${target}-shm`, `${target}-wal`]) await rm(ownedTarget, { force: true });
  await copyFile(source, target);
  for (const storageRoot of [process.env.PROFILE_MEDIA_ROOT, process.env.PRIVATE_CONTENT_ROOT]) {
    if (!storageRoot) continue;
    const resolved = path.resolve(storageRoot);
    if (!resolved.startsWith(taskRoot + path.sep)) throw new Error(`HOMEPORT_PHASE6_MEDIA_ROOT_REFUSED:${resolved}`);
    await rm(resolved, { recursive: true, force: true });
    await mkdir(resolved, { recursive: true });
  }
  await rm(evidenceRoot, { recursive: true, force: true });
  await mkdir(evidenceRoot, { recursive: true });

  const childEnv = {
    ...process.env,
    DATABASE_URL: `file:${target.replaceAll("\\", "/")}`,
    HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
    HOMEPORT_PHASE5_TASK_ROOT: taskRoot,
    HOMEPORT_PHASE6_TASK_ROOT: taskRoot,
  };
  const phase4 = seed(repositoryRoot, "scripts/homeport/seed-phase4-fixture.mjs", childEnv);
  const phase5 = seed(repositoryRoot, "scripts/homeport/seed-phase5-fixture.mjs", childEnv);
  await writeFile(
    path.join(taskRoot, "browser-state", "phase6-fixture-receipt.json"),
    `${JSON.stringify({ phase4, phase5, sourceDatabase: source, sourceBytes: sourceInfo.size }, null, 2)}\n`,
    "utf8",
  );
}

function seed(repositoryRoot: string, script: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [script], { cwd: repositoryRoot, encoding: "utf8", env });
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim());
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

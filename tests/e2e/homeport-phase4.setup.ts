import { spawnSync } from "node:child_process";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function prepareHomeportPhase4Database() {
  const repositoryRoot = path.resolve(process.cwd());
  const taskRoot = path.resolve(required("HOMEPORT_PHASE4_TASK_ROOT"));
  const source = path.resolve(required("HOMEPORT_PHASE4_SOURCE_DATABASE"));
  const target = path.resolve(required("HOMEPORT_PHASE4_DATABASE_PATH"));
  const evidenceRoot = path.resolve(required("HOMEPORT_PHASE4_EVIDENCE_ROOT"));
  const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
  const soundingLineOwned = process.env.HOMEPORT_SOUNDING_LINE_TASK_ROOT === "1";
  const approvedSoundingLineSource =
    soundingLineOwned &&
    source.startsWith(repositoryRoot + path.sep) &&
    /^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(source));
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size < 1)
    throw new Error(`Homeport Phase 4 source database is unavailable: ${source}`);
  if (source === canonicalDatabase || target === canonicalDatabase || source === target)
    throw new Error("Homeport Phase 4 refuses canonical or same-file database mutation.");
  if (
    (!source.startsWith(taskRoot + path.sep) && !approvedSoundingLineSource) ||
    !target.startsWith(taskRoot + path.sep)
  )
    throw new Error("Homeport Phase 4 database paths must remain inside the task root.");
  const approvedEvidenceRoot = path.join(
    repositoryRoot,
    "Development_Docs",
    "Projects",
    "Project_Homeport",
    "evidence",
    "phase4",
  );
  if (soundingLineOwned ? !evidenceRoot.startsWith(taskRoot + path.sep) : evidenceRoot !== approvedEvidenceRoot)
    throw new Error(`Homeport Phase 4 refuses an ungoverned evidence root: ${evidenceRoot}`);

  await mkdir(path.dirname(target), { recursive: true });
  for (const ownedTarget of [target, `${target}-shm`, `${target}-wal`]) await rm(ownedTarget, { force: true });
  await copyFile(source, target);
  for (const root of [process.env.PROFILE_MEDIA_ROOT, process.env.PRIVATE_CONTENT_ROOT]) {
    if (!root) continue;
    const resolved = path.resolve(root);
    if (!resolved.startsWith(taskRoot + path.sep)) throw new Error(`Homeport Phase 4 refuses media root: ${resolved}`);
    await rm(resolved, { recursive: true, force: true });
    await mkdir(resolved, { recursive: true });
  }
  await mkdir(evidenceRoot, { recursive: true });
  const seeded = spawnSync(process.execPath, ["scripts/homeport/seed-phase4-fixture.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: `file:${target.replaceAll("\\", "/")}`, HOMEPORT_PHASE4_TASK_ROOT: taskRoot },
  });
  if (seeded.status !== 0) throw new Error(`Homeport Phase 4 fixture failed:\n${seeded.stderr || seeded.stdout}`);
  const receipt = JSON.parse(seeded.stdout.trim());
  await writeFile(
    path.join(taskRoot, "fixture-receipt.json"),
    `${JSON.stringify({ ...receipt, sourceDatabase: source, sourceBytes: sourceInfo.size }, null, 2)}\n`,
    "utf8",
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

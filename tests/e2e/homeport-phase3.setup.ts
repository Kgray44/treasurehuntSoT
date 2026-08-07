import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export default async function prepareHomeportPhase3Database() {
  const source = path.resolve(
    process.env.HOMEPORT_PHASE3_SOURCE_DATABASE ?? "C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db",
  );
  const target = path.resolve(
    process.env.HOMEPORT_PHASE3_DATABASE_PATH ?? path.join(process.cwd(), ".homeport-phase3-e2e.db"),
  );
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size < 1)
    throw new Error(`Homeport Phase 3 source database is unavailable: ${source}`);
  if (target === source) throw new Error("Homeport Phase 3 refuses to mutate the canonical database.");
  await mkdir(path.dirname(target), { recursive: true });
  for (const ownedTarget of [target, `${target}-shm`, `${target}-wal`]) await rm(ownedTarget, { force: true });
  await copyFile(source, target);
  for (const root of [process.env.PROFILE_MEDIA_ROOT, process.env.PRIVATE_CONTENT_ROOT]) {
    if (!root) continue;
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(process.cwd(), "artifacts", "validation", "homeport-phase3")))
      throw new Error(`Homeport Phase 3 refuses an unowned media root: ${resolved}`);
    await rm(resolved, { recursive: true, force: true });
    await mkdir(resolved, { recursive: true });
  }
}

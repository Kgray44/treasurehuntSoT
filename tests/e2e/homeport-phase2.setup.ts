import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export default async function prepareHomeportPhase2Database() {
  const source = path.resolve(
    process.env.HOMEPORT_PHASE2_SOURCE_DATABASE ?? "C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db",
  );
  const target = path.resolve(
    process.env.HOMEPORT_PHASE2_DATABASE_PATH ?? path.join(process.cwd(), ".homeport-phase2-e2e.db"),
  );
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size < 1)
    throw new Error(`Homeport Phase 2 source database is unavailable: ${source}`);
  if (target === source) throw new Error("Homeport Phase 2 refuses to mutate the canonical database.");
  await mkdir(path.dirname(target), { recursive: true });
  await rm(target, { force: true });
  await rm(`${target}-shm`, { force: true });
  await rm(`${target}-wal`, { force: true });
  await copyFile(source, target);
}

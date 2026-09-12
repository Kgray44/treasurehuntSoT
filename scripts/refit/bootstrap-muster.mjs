import { DatabaseSync } from "node:sqlite";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = path.resolve(".runtime/muster");
await mkdir(root, { recursive: true });
const target = path.join(root, "muster.sqlite");
if (await stat(target).catch(() => null)) {
  console.log("Existing task-owned Muster database preserved.");
} else {
  // Generate a clean local schema from the canonical Prisma model. The historical
  // SQLite replay includes legacy CHAR declarations unsupported by the current client.
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.sqlite.prisma",
      "--script",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  await writeFile(path.join(root, "schema.sql"), result.stdout);
  const db = new DatabaseSync(target);
  try {
    db.exec(result.stdout);
  } finally {
    db.close();
  }
  console.log("Task-owned Muster schema created.");
}

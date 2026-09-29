import { DatabaseSync, backup } from "node:sqlite";
import { access, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Consistent SQLite online backup from a read-only handle. Owner sessions,
// roles, messages and readiness are neither reset nor written by this command.
const production = process.argv.slice(2).includes("--production");
if (process.argv.slice(2).some((arg) => arg !== "--production")) throw new Error("Only --production is supported.");
const source = path.resolve(production ? ".runtime/embarkation/audit-repair/fixture" : ".runtime/muster");
const target = path.resolve(
  production ? ".runtime/embarkation/audit-repair/production-fixture" : ".runtime/embarkation/audit-repair/fixture",
);
const database = path.join(target, "muster.sqlite");
let exists = false;
try {
  await access(database);
  exists = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (exists) throw new Error("Audit snapshot already exists; preserve it rather than reseeding.");
await access(path.join(source, "fixture.json"));
await mkdir(target, { recursive: true });
const db = new DatabaseSync(path.join(source, "muster.sqlite"), { readOnly: true });
try {
  await backup(db, database);
} finally {
  db.close();
}
for (const name of ["fixture.json", "chronicle-assets", "profile-media"]) {
  try {
    await cp(path.join(source, name), path.join(target, name), { recursive: true, errorOnExist: true, force: false });
  } catch (error) {
    if (error.code !== "ENOENT" || name === "fixture.json") throw error;
  }
}
await writeFile(
  path.join(target, "snapshot.json"),
  JSON.stringify(
    {
      kind: production ? "isolated-production-audit-fixture" : "isolated-audit-fixture",
      source,
      createdAt: new Date().toISOString(),
      method: "read-only SQLite online backup; local media copy; no seed",
    },
    null,
    2,
  ) + "\n",
);
console.log("Isolated audit fixture prepared. Owner database unchanged.");

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createSqliteBaselineManifest,
  sqliteBaselineCacheIdentity,
  verifySqliteBaseline,
} from "../../../scripts/sounding-line/v14/sqlite-baseline-artifact.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-sqlite-baseline-"));
  await Promise.all([
    mkdir(path.join(root, "prisma", "migrations", "0001_initial"), { recursive: true }),
    mkdir(path.join(root, "node_modules", "prisma"), { recursive: true }),
    mkdir(path.join(root, "scripts"), { recursive: true }),
    mkdir(path.join(root, "testing"), { recursive: true }),
    mkdir(path.join(root, "baseline"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(root, "prisma", "schema.sqlite.prisma"), 'datasource db { provider = "sqlite" }\n'),
    writeFile(
      path.join(root, "prisma", "migrations", "0001_initial", "migration.sql"),
      "CREATE TABLE baseline (id INTEGER);\n",
    ),
    writeFile(path.join(root, "prisma", "seed.ts"), "export {};\n"),
    writeFile(path.join(root, "scripts", "prepare-validation-isolation.ts"), "export {};\n"),
    writeFile(path.join(root, "package-lock.json"), "lock-v1\n"),
    writeFile(path.join(root, "node_modules", "prisma", "package.json"), '{"version":"6.17.1"}\n'),
    writeFile(
      path.join(root, "testing", "prepared-artifacts.json"),
      JSON.stringify({ layers: [{ id: "sqlite-baseline" }] }),
    ),
    writeFile(path.join(root, "baseline", "validation.db"), "immutable-sqlite\n"),
  ]);
  return root;
}

test("certified SQLite baseline changes identity for schema, migration, and seed inputs", async () => {
  const root = await fixture();
  try {
    const initial = await sqliteBaselineCacheIdentity(root);
    await writeFile(path.join(root, "prisma", "seed.ts"), "export const seed = 2;\n");
    assert.notEqual(initial.key, (await sqliteBaselineCacheIdentity(root)).key);
    await writeFile(
      path.join(root, "prisma", "migrations", "0001_initial", "migration.sql"),
      "CREATE TABLE changed (id INTEGER);\n",
    );
    assert.notEqual(initial.key, (await sqliteBaselineCacheIdentity(root)).key);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("certified SQLite baseline rejects corrupt immutable content", async () => {
  const root = await fixture();
  const originalKey = process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY;
  try {
    const identity = await sqliteBaselineCacheIdentity(root);
    const manifest = await createSqliteBaselineManifest({
      root,
      sourceDirectory: path.join(root, "baseline"),
      producer: identity.producer,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY = identity.key;
    await verifySqliteBaseline({ root, sourceDirectory: path.join(root, "baseline"), manifest });
    await writeFile(path.join(root, "baseline", "validation.db"), "corrupt\n");
    await assert.rejects(
      verifySqliteBaseline({ root, sourceDirectory: path.join(root, "baseline"), manifest }),
      /SQLITE_BASELINE_REJECTED/,
    );
  } finally {
    if (originalKey === undefined) delete process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY;
    else process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY = originalKey;
    await rm(root, { recursive: true, force: true });
  }
});

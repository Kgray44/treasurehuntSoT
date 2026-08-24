#!/usr/bin/env node
/* Creates an isolated SQLite schema from the checked-in migration history. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function splitMigrationStatements(sql) {
  sql = withoutLineComments(sql);
  const statements = [];
  let start = 0;
  let quote = null;
  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") quote = character;
    if (character === ";") {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const remaining = sql.slice(start).trim();
  if (remaining) statements.push(remaining);
  return statements;
}

function withoutLineComments(value) {
  return value
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

async function migrationFiles(root) {
  const migrationsRoot = path.join(root, "prisma", "migrations");
  return (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsRoot, entry.name, "migration.sql"))
    .sort();
}

async function main() {
  const optionIndex = process.argv.indexOf("--database-url");
  const databaseUrl = optionIndex >= 0 ? process.argv[optionIndex + 1] : undefined;
  if (!databaseUrl?.startsWith("file:")) throw new Error("SOUNDING_LINE_SQLITE_DATABASE_URL_REQUIRED");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    for (const file of await migrationFiles(process.cwd())) {
      for (const statement of splitMigrationStatements(await readFile(file, "utf8")))
        await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

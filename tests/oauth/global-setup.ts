import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup() {
  const databaseUrl = process.env.VOYAGEWRIGHT_OAUTH_VALIDATION_DATABASE_URL;
  if (!databaseUrl) throw new Error("OAuth validation database URL was not prepared.");
  const prismaCli = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

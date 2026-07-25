import path from "node:path";
import { discoverPrivateMigrations } from "../../src/private-content/migration-ledger";
const [, , target = "sqlite"] = process.argv;
if (!["sqlite", "mysql"].includes(target)) throw new Error("Usage: migration-ledger [sqlite|mysql]");
const root =
  target === "sqlite"
    ? path.join(process.cwd(), "prisma", "migrations")
    : path.join(process.cwd(), "prisma", "mysql-migrations");
const prefix = target === "sqlite" ? /^20260725/ : /^002[89]_project_sealed_hold_phase3/;
void discoverPrivateMigrations(root, prefix)
  .then((migrations) => process.stdout.write(`${JSON.stringify({ target, migrations })}\n`))
  .catch(() => {
    process.stderr.write("Private migration ledger failed.\n");
    process.exitCode = 1;
  });

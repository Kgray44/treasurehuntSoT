import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const databasePath = process.env.NIGHTWATCH_DB_PATH?.trim()
  ? resolve(process.env.NIGHTWATCH_DB_PATH)
  : join(
      process.env.LOCALAPPDATA?.trim() || process.env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state"),
      "ForeverTreasureCompanion",
      "Nightwatch",
      "treasurehuntSoT",
      "nightwatch.sqlite",
    );
if (!process.env.NIGHTWATCH_DB_PATH && !databasePath) throw new Error("NIGHTWATCH_DATABASE_PATH_UNRESOLVED");
const database = new DatabaseSync(databasePath, { readonly: true });
try {
  const row = database
    .prepare(
      "SELECT instance_id AS instanceId, state, heartbeat_at AS heartbeatAt, last_successful_reconciliation_at AS lastSuccessfulReconciliationAt, detail FROM controller_health WHERE singleton = 1",
    )
    .get();
  process.stdout.write(`${JSON.stringify(row ?? { state: "DOWN", detail: "Controller health is unavailable." })}\n`);
} finally {
  database.close();
}

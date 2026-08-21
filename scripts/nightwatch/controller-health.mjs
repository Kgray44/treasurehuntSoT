import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.NIGHTWATCH_DB_PATH;
if (!databasePath) throw new Error("NIGHTWATCH_DB_PATH_REQUIRED");
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

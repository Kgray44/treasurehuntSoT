import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NightwatchLedger, resolveNightwatchDatabase } from "../../src/nightwatch/runtime";
import { BosunLedger } from "../../src/nightwatch/bosun";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const command = args[0];
const positional = args.slice(1).filter((value) => !value.startsWith("--"));
const databaseArgument = positional.find((value) => value === ":memory:" || /\.sqlite$/iu.test(value));
const values = positional.filter((value) => value !== databaseArgument);
const required = (value: string | undefined, label: string) => {
  if (!value) throw new Error(`NIGHTWATCH_CLI_REQUIRED:${label}`);
  return value;
};
const number = (value: string | undefined, label: string) => {
  const result = Number(required(value, label));
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`NIGHTWATCH_CLI_INVALID_NUMBER:${label}`);
  return result;
};
const argument = (flag: string, index: number) => option(flag) ?? values[index];
const databasePath = option("--db") ?? databaseArgument ?? resolveNightwatchDatabase(process.cwd());
const ledger = new NightwatchLedger(databasePath, { repositoryRoot: process.cwd() });
const bosun = new BosunLedger(databasePath, ledger);

try {
  if (command === "reserve") {
    const count = number(argument("--count", 3), "--count or positional count");
    const ttlMinutes = option("--ttl-minutes") ? number(option("--ttl-minutes"), "--ttl-minutes") : 60;
    const start = option("--start");
    const result = ledger.reserveMigrationRange({
      family: required(argument("--family", 0), "--family or positional family"),
      project: required(argument("--project", 1), "--project or positional project"),
      objectiveId: required(argument("--objective", 2), "--objective or positional objective"),
      candidateId: option("--candidate"),
      count,
      startId: start ? number(start, "--start") : undefined,
      ttlMs: ttlMinutes * 60_000,
    });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "reservations") {
    console.log(JSON.stringify(ledger.reservations(), null, 2));
  } else if (command === "release") {
    console.log(
      JSON.stringify(
        ledger.releaseReservation(
          required(argument("--id", 0), "--id or positional reservation id"),
          required(argument("--owner", 1), "--owner or positional owner"),
        ),
        null,
        2,
      ),
    );
  } else if (command === "reconcile") {
    console.log(JSON.stringify(ledger.reconcileMigrationReservations(), null, 2));
  } else if (command === "projection") {
    console.log(JSON.stringify(ledger.projection(), null, 2));
  } else if (command === "bosun-projection") {
    console.log(JSON.stringify(bosun.projection(), null, 2));
  } else if (command === "bosun-reconcile-objectives") {
    console.log(JSON.stringify(bosun.reconcileActionableObjectives(), null, 2));
  } else if (command === "bosun-authorize-owner") {
    const cascadeId = required(argument("--cascade", 0), "--cascade or positional cascade id");
    const authorization = required(argument("--authorization", 1), "--authorization or positional authorization");
    console.log(JSON.stringify(bosun.authorizeOwnerObjective(cascadeId, authorization), null, 2));
  } else if (command === "bosun-ingest-baseline") {
    const receiptPath = required(option("--receipt"), "--receipt");
    const mainSha = required(option("--main-sha"), "--main-sha");
    const mainTreeSha = required(option("--main-tree"), "--main-tree");
    const receipt = JSON.parse(readFileSync(resolve(receiptPath), "utf8")) as unknown;
    console.log(
      JSON.stringify(
        bosun.ingestBaselineReceipt({ receipt, protectedMain: { sha: mainSha, treeSha: mainTreeSha } }),
        null,
        2,
      ),
    );
  } else {
    throw new Error(
      "USAGE: nightwatch <reserve|reservations|release|reconcile|projection|bosun-projection|bosun-reconcile-objectives|bosun-authorize-owner|bosun-ingest-baseline>; bosun-ingest-baseline requires --receipt, --main-sha, and --main-tree.",
    );
  }
} finally {
  bosun.close();
  ledger.close();
}

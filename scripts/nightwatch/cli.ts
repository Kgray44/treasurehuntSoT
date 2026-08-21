import { defaultNightwatchDatabase, NightwatchLedger } from "../../src/nightwatch/runtime";
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
const databasePath = option("--db") ?? databaseArgument ?? defaultNightwatchDatabase(process.cwd());
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
  } else {
    throw new Error(
      "USAGE: nightwatch <reserve|reservations|release|reconcile|projection|bosun-projection>; reserve accepts <family> <project> <objective> <count> [database.sqlite] or direct-execution flags.",
    );
  }
} finally {
  bosun.close();
  ledger.close();
}

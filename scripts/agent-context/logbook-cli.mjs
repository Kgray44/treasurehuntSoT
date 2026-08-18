import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  canonicalJson,
  createLogbook,
  readReuseDecision,
  recordExpansion,
  recordRead,
  recordSearch,
  searchReuseDecision,
} from "./logbook.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
function jsonOption(name) {
  const value = option(name);
  return value ? JSON.parse(value) : null;
}

const command = option("--command");
const ledgerPath = option("--ledger");
const entry = jsonOption("--entry");
if (!command || !ledgerPath) throw new Error("USAGE: logbook-cli.mjs --command <init|record-read|record-search|record-expansion|read-decision|search-decision> --ledger <json> [--entry <json>]");
const current = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, "utf8"))
  : createLogbook(option("--task-id") ?? "unidentified-task", option("--packet-digest"));
let result;
switch (command) {
  case "init":
    result = current;
    break;
  case "record-read":
    result = recordRead(current, entry ?? {});
    break;
  case "record-search":
    result = recordSearch(current, entry ?? {});
    break;
  case "record-expansion":
    result = recordExpansion(current, entry ?? {});
    break;
  case "read-decision":
    result = readReuseDecision(current, entry ?? {});
    break;
  case "search-decision":
    result = searchReuseDecision(current, entry ?? {});
    break;
  default:
    throw new Error(`UNKNOWN_LOGBOOK_COMMAND:${command}`);
}
if (!command.endsWith("-decision")) {
  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, `${canonicalJson(current)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify({ command, ledger: ledgerPath, result })}\n`);

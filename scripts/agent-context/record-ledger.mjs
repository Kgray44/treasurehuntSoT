import { readFile, writeFile } from "node:fs/promises";
import { addExpansion } from "./core.mjs";
const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const ledgerPath = value("--ledger");
if (!ledgerPath)
  throw new Error("USAGE: --ledger <path> --reason-class <class> --reason <text> --source <path> --result <text>");
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
addExpansion(ledger, {
  reasonClass: value("--reason-class"),
  reason: value("--reason"),
  source: value("--source"),
  result: value("--result"),
});
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(
  JSON.stringify({ ledger: ledgerPath, expansions: ledger.expansions.length, reads: ledger.reads.length }, null, 2),
);

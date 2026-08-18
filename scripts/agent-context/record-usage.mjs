import { readFile, writeFile } from "node:fs/promises";
import { usageRecord } from "./core.mjs";
const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const input = JSON.parse(await readFile(value("--input"), "utf8"));
const record = usageRecord(input);
if (value("--out")) await writeFile(value("--out"), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
